import { Link } from 'react-router';
import { EmptyState } from '../components/ui/EmptyState';
import { Button } from '../components/ui/Button';
import { useAuth, useMe } from '../lib/auth';

export function NoVenuePage() {
  const me = useMe();
  const { signOut } = useAuth();
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <EmptyState
        icon="venues"
        title="No venue yet"
        description={
          <>
            {me.user.email} is not a member of any restaurant. Ask the owner to invite you, or create a new restaurant with
            another account.
          </>
        }
        actions={
          <>
            {me.user.isSuperadmin ? (
              <Link to="/superadmin" className="no-underline">
                <Button variant="primary">All restaurants</Button>
              </Link>
            ) : null}
            <Button onClick={() => void signOut()}>Sign out</Button>
          </>
        }
      />
    </div>
  );
}
