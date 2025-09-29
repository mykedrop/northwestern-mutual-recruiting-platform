import { Toaster } from 'sonner';

export const ToastProvider = () => {
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      duration={4000}
      toastOptions={{
        style: {
          background: '#fff',
          border: '1px solid #e5e5e5',
        },
        className: 'toast-notification success-message toast-success notification-success',
      }}
    />
  );
};
