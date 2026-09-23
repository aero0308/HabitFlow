"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/features/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DangerZone } from "@/features/settings/DangerZone";

/**
 * AccountTab — the "Account" tab on the Settings page.
 *
 * Sections in order:
 *   1. Session — Log out button (with confirmation dialog).
 *   2. Danger Zone — destructive actions (Delete account, delete all data,
 *      reset habit progress). Rendered via the existing <DangerZone />.
 */
export function AccountTab() {
  const { logout } = useAuth();
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* 1. Session */}
      <Card className="p-6 border-destructive/30">
        <div className="flex items-center gap-2 mb-4">
          <LogOut className="w-5 h-5 text-destructive" />
          <h3 className="font-semibold">Session</h3>
        </div>
        <Button
          variant="outline"
          onClick={() => setLogoutOpen(true)}
          className="text-destructive hover:text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" /> Log out
        </Button>
      </Card>

      {/* 2. Danger Zone */}
      <DangerZone />

      {/* Logout confirmation dialog (mounted at the tab level) */}
      <AlertDialog open={logoutOpen} onOpenChange={setLogoutOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Log out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will need to sign in again to continue tracking.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => logout()}>Log out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
