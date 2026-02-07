import { FileText, CreditCard, UserPlus, HelpCircle, Clock, Users, type LucideIcon } from "lucide-react";

export const serviceIcons: Record<string, LucideIcon> = {
  FileText,
  CreditCard,
  UserPlus,
  HelpCircle,
  Clock,
  Users,
};

export function getServiceIcon(iconName: string): LucideIcon {
  return serviceIcons[iconName] || FileText;
}
