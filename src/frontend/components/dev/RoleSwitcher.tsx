'use client';

import { useRole } from '@/src/frontend/contexts/RoleContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { UserCircle } from 'lucide-react';

export function RoleSwitcher() {
  const { currentRole, setRole } = useRole();

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'buyer':
        return 'default';
      case 'seller':
        return 'secondary';
      case 'auditor':
        return 'outline';
      default:
        return 'default';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted">
        <UserCircle className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">DEV:</span>
        <Select value={currentRole} onValueChange={(value: any) => setRole(value)}>
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="buyer">Buyer</SelectItem>
            <SelectItem value="seller">Seller</SelectItem>
            <SelectItem value="auditor">Auditor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="sm:hidden">
        <Badge variant={getRoleColor(currentRole)} className="capitalize">
          {currentRole}
        </Badge>
      </div>
    </div>
  );
}
