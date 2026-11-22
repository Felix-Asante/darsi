"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { DRIVE_AUDIENCES, type DriveAudience, type DriveItem } from "@/common/types/files";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface ItemChanges {
  name: string;
  parentId: string | null;
  visibility: DriveAudience[];
}

const TOP = "top";

interface EditItemDialogProps {
  item: DriveItem | null;
  /** Where an item can move: the top, the folder above, and folders here. */
  folders: { id: string; name: string }[];
  onClose: () => void;
  onSave: (changes: ItemChanges) => Promise<unknown>;
}

export function EditItemDialog({ item, folders, onClose, onSave }: Readonly<EditItemDialogProps>) {
  const t = useTranslations("files.drive");
  const tCommon = useTranslations("common");
  const [name, setName] = useState(item?.name ?? "");
  const [parentId, setParentId] = useState(item?.parentId ?? TOP);
  const [visibility, setVisibility] = useState<DriveAudience[]>(item?.visibility ?? []);
  const [saving, setSaving] = useState(false);
  const targets = [{ value: TOP, label: t("topLevel") }, ...folders.filter((folder) => folder.id !== item?.id).map((folder) => ({ value: folder.id, label: folder.name }))];

  return (
    <Dialog open={item !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            setSaving(true);
            try {
              await onSave({ name: name.trim(), parentId: parentId === TOP ? null : parentId, visibility });
              onClose();
            } finally {
              setSaving(false);
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("editTitle", { name: item?.name ?? "" })}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drive-item-name">{t("name")}</Label>
            <Input id="drive-item-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="drive-item-parent">{t("moveTo")}</Label>
            <Select items={targets} value={parentId} onValueChange={(value) => setParentId(value ?? TOP)}>
              <SelectTrigger id="drive-item-parent" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targets.map((target) => (
                  <SelectItem key={target.value} value={target.value}>
                    {target.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-medium">{t("visibleTo")}</legend>
            {DRIVE_AUDIENCES.map((audience) => (
              <label key={audience} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={visibility.includes(audience)}
                  onCheckedChange={(checked) =>
                    setVisibility((current) => (checked === true ? [...current, audience] : current.filter((entry) => entry !== audience)))
                  }
                />
                {t(`audiences.${audience}`)}
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
