import { useEffect } from 'react';
import { toast } from 'sonner';
import { useStore } from '../store';

export const useNotifications = () => {
  const { ui } = useStore();

  useEffect(() => {
    if (ui.successMessage) {
      toast.success(ui.successMessage);
    }
  }, [ui.successMessage]);

  useEffect(() => {
    if (ui.error) {
      toast.error(ui.error);
    }
  }, [ui.error]);

  return {
    success: (message: string) => toast.success(message),
    error: (message: string) => toast.error(message),
    info: (message: string) => toast.info(message),
    warning: (message: string) => toast.warning(message),
  };
};
