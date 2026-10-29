import { useState } from 'react';
import { useNavigate } from 'react-router';
import { openAsOwner } from '../../lib/admin';
import { errorMessage } from '../../lib/api';
import { useToast } from '../ui/Toast';

/** "Open as owner": fetch an impersonation token for the venue and enter its CMS (the banner shows there). */
export function useOpenAsOwner() {
  const navigate = useNavigate();
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const open = async (restaurantId: string, screen = 'menu') => {
    setPending(true);
    try {
      await openAsOwner(restaurantId);
      navigate(`/r/${restaurantId}/${screen}`);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not open the venue'));
    } finally {
      setPending(false);
    }
  };
  return { open, pending };
}
