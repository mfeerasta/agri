#!/usr/bin/env bash
# Zameen VPS bootstrap. Idempotent. Safe to re-run.
# Target: fresh Ubuntu 24.04 LTS on Hetzner CPX31. Run as root.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/feerasta/zameen/main/deploy/bootstrap-vps.sh | bash
#   DOPPLER_TOKEN=dp.st.xxx bash deploy/bootstrap-vps.sh
#
# Env knobs:
#   REPO_URL       default git@github.com:feerasta/zameen.git
#   REPO_DIR       default /opt/zameen
#   BRANCH         default main
#   DOPPLER_TOKEN  optional, when set the script seeds /opt/zameen/.env from Doppler
set -euo pipefail

REPO_URL="${REPO_URL:-git@github.com:feerasta/zameen.git}"
REPO_DIR="${REPO_DIR:-/opt/zameen}"
BRANCH="${BRANCH:-main}"
DEPLOY_USER="${DEPLOY_USER:-deploy}"

log() { printf '\n\033[1;32m[bootstrap]\033[0m %s\n' "$*"; }
warn() { printf '\n\033[1;33m[bootstrap]\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m[bootstrap]\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "must run as root"

############################################
# 1. apt baseline
############################################
log "apt baseline"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg lsb-release git cron ufw fail2ban \
  docker.io docker-compose-plugin awscli jq

systemctl enable --now docker
systemctl enable --now cron
systemctl enable --now fail2ban

############################################
# 2. deploy user
############################################
if ! id -u "$DEPLOY_USER" >/dev/null 2>&1; then
  log "create user $DEPLOY_USER"
  adduser --disabled-password --gecos "" "$DEPLOY_USER"
  usermod -aG sudo,docker "$DEPLOY_USER"
  echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" >/etc/sudoers.d/90-"$DEPLOY_USER"
  chmod 440 /etc/sudoers.d/90-"$DEPLOY_USER"
  mkdir -p /home/"$DEPLOY_USER"/.ssh
  if [[ -f /root/.ssh/authorized_keys ]]; then
    cp /root/.ssh/authorized_keys /home/"$DEPLOY_USER"/.ssh/authorized_keys
  fi
  chown -R "$DEPLOY_USER:$DEPLOY_USER" /home/"$DEPLOY_USER"/.ssh
  chmod 700 /home/"$DEPLOY_USER"/.ssh
  chmod 600 /home/"$DEPLOY_USER"/.ssh/authorized_keys 2>/dev/null || true
else
  log "user $DEPLOY_USER already exists"
fi

############################################
# 3. ufw firewall
############################################
log "configure ufw"
ufw --force reset >/dev/null
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

############################################
# 4. doppler cli
############################################
if ! command -v doppler >/dev/null 2>&1; then
  log "install doppler cli"
  curl -sLf --tlsv1.2 --retry 3 --retry-delay 2 \
    https://packages.doppler.com/public/cli/gpg.DE2A7741A397C129.key \
    | gpg --dearmor -o /usr/share/keyrings/doppler-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/doppler-archive-keyring.gpg] \
    https://packages.doppler.com/public/cli/deb/debian any-version main" \
    >/etc/apt/sources.list.d/doppler-cli.list
  apt-get update -y
  apt-get install -y doppler
else
  log "doppler already installed"
fi

############################################
# 5. deploy key + clone
############################################
SSH_DIR="/home/$DEPLOY_USER/.ssh"
KEY_PATH="$SSH_DIR/id_ed25519_zameen"
if [[ ! -f "$KEY_PATH" ]]; then
  log "generate deploy key"
  sudo -u "$DEPLOY_USER" ssh-keygen -t ed25519 -N "" -C "zameen-deploy@$(hostname)" -f "$KEY_PATH"
  cat <<EOF

###############################################################
# DEPLOY KEY GENERATED
# Add this public key as a READ-ONLY deploy key on the GitHub repo:
#   https://github.com/feerasta/zameen/settings/keys
###############################################################
EOF
  cat "${KEY_PATH}.pub"
  echo
  echo "Re-run this script once the key is added. Continuing will attempt the clone."
fi

# Add github to known_hosts
sudo -u "$DEPLOY_USER" bash -c "ssh-keyscan -t ed25519 github.com >> $SSH_DIR/known_hosts 2>/dev/null || true"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  log "clone $REPO_URL into $REPO_DIR"
  mkdir -p "$(dirname "$REPO_DIR")"
  GIT_SSH_COMMAND="ssh -i $KEY_PATH -o StrictHostKeyChecking=accept-new" \
    sudo -u "$DEPLOY_USER" git clone --branch "$BRANCH" "$REPO_URL" "$REPO_DIR" \
    || fail "git clone failed. Confirm the deploy key is registered on GitHub."
else
  log "repo exists, pulling latest"
  sudo -u "$DEPLOY_USER" git -C "$REPO_DIR" fetch origin
  sudo -u "$DEPLOY_USER" git -C "$REPO_DIR" checkout "$BRANCH"
  sudo -u "$DEPLOY_USER" git -C "$REPO_DIR" pull --ff-only origin "$BRANCH"
fi

chown -R "$DEPLOY_USER:$DEPLOY_USER" "$REPO_DIR"

############################################
# 6. /opt/zameen/.env
############################################
ENV_FILE="$REPO_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -n "${DOPPLER_TOKEN:-}" ]]; then
    log "seed .env from doppler"
    sudo -u "$DEPLOY_USER" bash -c "DOPPLER_TOKEN='$DOPPLER_TOKEN' doppler secrets download --no-file --format env --project zameen --config prod" >"$ENV_FILE"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  else
    warn "DOPPLER_TOKEN not set, copying .env.example to .env. Fill it in manually."
    cp "$REPO_DIR/.env.example" "$ENV_FILE"
    chown "$DEPLOY_USER:$DEPLOY_USER" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
  fi
else
  log ".env already exists, leaving alone"
fi

############################################
# 7. systemd weekly autopull timer
############################################
log "install zameen-autopull.timer"
cat >/etc/systemd/system/zameen-autopull.service <<EOF
[Unit]
Description=Zameen weekly git pull and docker compose refresh
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
User=$DEPLOY_USER
WorkingDirectory=$REPO_DIR
ExecStart=/usr/bin/git pull --ff-only origin $BRANCH
ExecStart=/usr/bin/docker compose pull
ExecStart=/usr/bin/docker compose up -d --remove-orphans
EOF

cat >/etc/systemd/system/zameen-autopull.timer <<EOF
[Unit]
Description=Run Zameen autopull weekly

[Timer]
OnCalendar=Sun 03:00 UTC
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now zameen-autopull.timer

############################################
# 8. daily backup cron
############################################
log "install daily backup cron"
BACKUP_CRON="/etc/cron.d/zameen-backup"
cat >"$BACKUP_CRON" <<EOF
# Zameen daily logical pg_dump to R2
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
30 2 * * * $DEPLOY_USER cd $REPO_DIR && /bin/bash deploy/backup.sh >>/var/log/zameen-backup.log 2>&1
EOF
chmod 644 "$BACKUP_CRON"
touch /var/log/zameen-backup.log
chown "$DEPLOY_USER:$DEPLOY_USER" /var/log/zameen-backup.log

log "bootstrap complete"
log "next: edit $ENV_FILE if needed, then 'su - $DEPLOY_USER -c \"cd $REPO_DIR && docker compose up -d --build\"'"
