"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Loader2, Mail, Save, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/api/client";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

const profileSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .max(60, "First name is too long"),
  lastName: z.string().max(60, "Last name is too long").optional().or(z.literal("")),
});

type ProfileForm = z.infer<typeof profileSchema>;

function initialsOf(first?: string, last?: string, fallback?: string) {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (f || l) return (f[0] ?? "") + (l[0] ?? "");
  if (fallback) {
    return fallback
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return "?";
}

function resizeImage(file: File, maxSize: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;
        if (width > height) {
          if (width > maxSize) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("No canvas context"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ProfileSection() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
    enabled: !!user,
  });

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: {
      firstName: settings?.firstName ?? "",
      lastName: settings?.lastName ?? "",
    },
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
    },
  });

  const {
    formState: { errors, isDirty },
    handleSubmit,
    register,
  } = form;

  const updateMut = useMutation({
    mutationFn: (body: Partial<{ firstName: string; lastName: string; avatarUrl: string }>) =>
      api.updateSettings(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings"] });
      qc.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Profile saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleAvatarUpload(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataUrl = await resizeImage(file, 256);
      updateMut.mutate({ avatarUrl: dataUrl });
      toast.success("Profile picture updated");
    } catch {
      toast.error("Could not process image");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  }

  const avatarUrl = settings?.avatarUrl || user?.avatarUrl;
  const firstName = settings?.firstName ?? user?.firstName ?? "";
  const lastName = settings?.lastName ?? user?.lastName ?? "";
  const initials = initialsOf(firstName, lastName, user?.name);

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <UserIcon className="w-5 h-5 text-violet-500" />
        <h2 className="font-semibold">Profile</h2>
      </div>

      {/* Avatar block — centered on mobile, left-aligned on desktop */}
      <div className="mb-6 flex flex-col items-center sm:items-start gap-3">
        <button
          type="button"
          onClick={() => avatarInputRef.current?.click()}
          disabled={uploadingAvatar || updateMut.isPending}
          className="relative group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-70"
          aria-label="Change profile picture"
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user?.name ?? "Profile"}
              className="w-20 h-20 rounded-full object-cover border-2 border-border"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xl font-semibold">
              {initials}
            </div>
          )}
          <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
            {uploadingAvatar ? (
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
            ) : (
              <Camera className="w-3.5 h-3.5 text-foreground" />
            )}
          </span>
        </button>
        {/* Name display below avatar (mobile only) */}
        <div className="text-center sm:hidden">
          <p className="text-sm font-medium text-foreground">
            {[firstName, lastName].filter(Boolean).join(" ") || user?.name || "Your name"}
          </p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleAvatarUpload(f);
          }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-32" />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit((data) =>
            updateMut.mutate({
              firstName: data.firstName.trim(),
              lastName: (data.lastName ?? "").trim(),
            }),
          )}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-firstName">First Name</Label>
              <Input
                id="p-firstName"
                autoComplete="given-name"
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-lastName">Last Name</Label>
              <Input
                id="p-lastName"
                autoComplete="family-name"
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="p-email"
                value={settings?.email ?? user?.email ?? ""}
                readOnly
                className="pl-9 bg-muted/50 cursor-not-allowed"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Email cannot be changed.
            </p>
          </div>

          <Button type="submit" disabled={updateMut.isPending || !isDirty}>
            {updateMut.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save changes
          </Button>
        </form>
      )}
    </Card>
  );
}
