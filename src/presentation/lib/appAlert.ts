import Swal from "sweetalert2";
import toast from "react-hot-toast";

type ConfirmOptions = {
  title: string;
  text?: string;
  confirmText?: string;
  cancelText?: string;
};

const baseOptions = {
  background: "#252A34",
  color: "#EAEAEA",
  confirmButtonColor: "#08D9D6",
  cancelButtonColor: "#FF2E63",
  customClass: {
    popup: "app-alert-popup",
    title: "app-alert-title",
    confirmButton: "app-alert-confirm",
    cancelButton: "app-alert-cancel"
  }
} as const;

export const appAlert = {
  success: (title: string, text?: string) => toast.success(text ? `${title}: ${text}` : title),
  error: (title: string, text?: string) => toast.error(text ? `${title}: ${text}` : title),
  info: (title: string, text?: string) => toast(text ? `${title}: ${text}` : title),
  warning: (title: string, text?: string) => toast(text ? `${title}: ${text}` : title),
  critical: (title: string, text?: string) =>
    Swal.fire({
      ...baseOptions,
      icon: "error",
      title,
      text
    }),
  confirm: async ({
    title,
    text,
    confirmText = "Confirm",
    cancelText = "Cancel"
  }: ConfirmOptions): Promise<boolean> => {
    const result = await Swal.fire({
      ...baseOptions,
      icon: "question",
      title,
      text,
      showCancelButton: true,
      confirmButtonText: confirmText,
      cancelButtonText: cancelText
    });

    return result.isConfirmed;
  }
};
