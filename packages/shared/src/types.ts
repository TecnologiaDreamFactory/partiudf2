import type { UserRole } from './enums';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}
