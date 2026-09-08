import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isEncryptedNotePath(path: string): boolean {
  return path.endsWith(".md.enc");
}
