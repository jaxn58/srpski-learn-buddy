import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TopupOptions } from "./TopupOptions";
import { useTranslation } from "react-i18next";
import { ReactNode } from "react";

interface TopupDialogProps {
  children: ReactNode;
}

export function TopupDialog({ children }: TopupDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("energy.topUp")}</DialogTitle>
          <DialogDescription>{t("energy.topUpDesc")}</DialogDescription>
        </DialogHeader>
        <TopupOptions compact />
      </DialogContent>
    </Dialog>
  );
}
