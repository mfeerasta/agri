import { Card, CardContent, CardHeader, CardTitle, Masthead } from '@zameen/ui';
import { NewRouteForm } from './new-route-form';

export const dynamic = 'force-dynamic';

export default function NewRoutePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Masthead section="New dispatch route" />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Define route waypoints</CardTitle>
        </CardHeader>
        <CardContent>
          <NewRouteForm />
        </CardContent>
      </Card>
    </div>
  );
}
