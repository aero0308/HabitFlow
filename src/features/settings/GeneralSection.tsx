"use client";

import { useTheme } from "next-themes";
import { Laptop, Moon, Palette, Sun } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ThemeOption = "light" | "dark" | "system";

const THEME_OPTIONS: {
  value: ThemeOption;
  label: string;
  icon: typeof Sun;
}[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
];

export function GeneralSection() {
  const { theme, setTheme } = useTheme();

  // next-themes returns undefined during SSR / first paint. Fall back to "system"
  // to avoid hydration mismatches; the resolved value appears after mount.
  const currentThemeValue = (theme as ThemeOption | undefined) ?? "system";
  const ActiveThemeIcon =
    THEME_OPTIONS.find((o) => o.value === currentThemeValue)?.icon ?? Laptop;

  function handleThemeChange(value: ThemeOption) {
    setTheme(value);
    toast.success(
      `Theme set to ${THEME_OPTIONS.find((o) => o.value === value)?.label}`,
    );
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <Palette className="w-5 h-5 text-violet-500" />
        <h2 className="font-semibold">Appearance</h2>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="pr-4 min-w-0">
            <Label className="text-sm font-medium">Theme</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Choose how HabitFlow looks. System follows your device setting.
            </p>
          </div>
          <Select value={currentThemeValue} onValueChange={(v) => handleThemeChange(v as ThemeOption)}>
            <SelectTrigger className="w-[160px] sm:w-[180px]">
              <ActiveThemeIcon className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="System" />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <SelectItem key={opt.value} value={opt.value}>
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                      <span>{opt.label}</span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
