import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { useMe } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { uploadEmergencyContactImage } from "@/lib/emergency-contacts.functions";
import { EMERGENCY_CONTACT_IMAGE, EMERGENCY_CONTACT_IMAGE_TYPES } from "@/lib/emergency-contacts";

export function EmergencyContactImage() {
  const [open, setOpen] = useState(false);
  const { me, session } = useMe();
  const queryClient = useQueryClient();
  const queryKey = ["emergency-contact-image", session?.user.id];
  const image = useQuery({
    queryKey,
    enabled: open && !!me?.isStaff,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(EMERGENCY_CONTACT_IMAGE, 120);
      if (error) throw new Error("등록된 비상연락망 이미지를 불러올 수 없습니다.");
      return data.signedUrl;
    },
  });
  const save = useServerFn(uploadEmergencyContactImage);
  const upload = useMutation({
    mutationFn: (data: FormData) => save({ data }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="mt-5 cursor-pointer text-sm font-semibold underline">
          에너인프라 비상연락망
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
        <DialogTitle>에너인프라 비상연락망</DialogTitle>
        <DialogDescription>사내 비상 연락용 자료입니다.</DialogDescription>
        {!me ? (
          <p role="status" className="text-sm text-muted-foreground">
            계정을 확인하는 중…
          </p>
        ) : !me.isStaff ? (
          <p className="text-sm text-muted-foreground">활성 직원 계정만 볼 수 있습니다.</p>
        ) : image.isError ? (
          <p role="alert" className="text-sm text-muted-foreground">
            {image.error.message}
          </p>
        ) : image.data ? (
          <img
            key={image.data}
            src={image.data}
            alt="주식회사 에너인프라 비상연락망"
            className="mx-auto max-h-[65dvh] max-w-full rounded-md border object-contain"
          />
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            이미지를 불러오는 중…
          </p>
        )}
        {me?.isStaff && me.isAdmin && (
          <form
            className="space-y-2 border-t pt-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!upload.isPending) upload.mutate(new FormData(event.currentTarget));
            }}
          >
            <label htmlFor="emergency-contact-file" className="text-sm font-medium">
              비상연락망 이미지 등록
            </label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="emergency-contact-file"
                name="image"
                type="file"
                required
                accept={EMERGENCY_CONTACT_IMAGE_TYPES.join(",")}
                className="w-auto max-w-full"
              />
              <Button type="submit" disabled={upload.isPending}>
                {upload.isPending ? "등록 중…" : "등록"}
              </Button>
            </div>
            {upload.error && (
              <p role="alert" className="text-sm text-destructive">
                {upload.error.message}
              </p>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
