import toast from "react-hot-toast";

type ConfirmOptions = {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
};

export const appAlert = {
  success: (title: string, text?: string) => toast.success(text ? `${title}: ${text}` : title),
  error: (title: string, text?: string) => toast.error(text ? `${title}: ${text}` : title),
  info: (title: string, text?: string) => toast(text ? `${title}: ${text}` : title),
  warning: (title: string, text?: string) => toast(text ? `${title}: ${text}` : title),
  critical: (title: string, text?: string) => toast.error(text ? `${title}: ${text}` : title, { duration: 4000 }),
  confirm: async ({
    title,
    text,
    confirmText = "Confirm",
    cancelText = "Cancel"
  }: ConfirmOptions): Promise<boolean> => {
    const message = [title, text].filter(Boolean).join("\n");
    const confirmed = window.confirm(message || confirmText);
    if (!confirmed && cancelText) {
      toast(cancelText);
    }
    return confirmed;
  }
};
