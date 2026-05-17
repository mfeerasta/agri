import { LoginForm } from './login-form';
import { Masthead } from '@zameen/ui';
import { LocaleToggle } from '../../components/locale-toggle';

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <div className="flex items-center justify-end">
        <LocaleToggle />
      </div>
      <Masthead section="Login" />
      <LoginForm />
    </main>
  );
}
