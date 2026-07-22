// Hand-written for now, mirroring supabase/migrations/0001_init.sql.
// Once the Supabase project is linked, replace this file's contents with:
//   supabase gen types typescript --project-id <ref> > packages/shared-types/src/database.ts
// and re-export from there instead of maintaining these by hand.

export type DealerStatus = "pending" | "approved" | "suspended";
export type StaffRole = "owner" | "staff";
export type StaffStatus = "invited" | "active" | "deactivated";
export type CarStatus = "available" | "reserved" | "sold";
export type LeadSource = "pakwheels" | "walk_in" | "referral" | "phone" | "website" | "other";
export type LeadStage = "new" | "contacted" | "test_drive_scheduled" | "negotiating" | "closed_won" | "closed_lost";
export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";
export type AiAction = "summarize_notes" | "draft_followup";

export interface Dealer {
  id: string;
  name: string;
  city: string;
  contact_phone: string | null;
  status: DealerStatus;
  created_at: string;
}

export interface DealerStaff {
  id: string;
  dealer_id: string;
  user_id: string;
  full_name: string;
  role: StaffRole;
  status: StaffStatus;
  invited_by: string | null;
  deactivated_at: string | null;
  created_at: string;
}

export interface StaffInvite {
  id: string;
  dealer_id: string;
  email: string;
  role: Exclude<StaffRole, "owner">;
  invited_by: string;
  status: InviteStatus;
  dealer_staff_id: string | null;
  created_at: string;
  expires_at: string;
}

export interface Car {
  id: string;
  dealer_id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  status: CarStatus;
  specs: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CarPhoto {
  id: string;
  car_id: string;
  storage_path: string;
  sort_order: number;
  created_at: string;
}

export interface Lead {
  id: string;
  dealer_id: string;
  car_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  source: LeadSource;
  stage: LeadStage;
  assigned_to: string | null;
  lost_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  actor_id: string | null;
  action: string;
  detail: string | null;
  created_at: string;
}

export interface AdminUser {
  id: string;
  user_id: string;
  full_name: string;
  created_at: string;
}

export interface AiUsageLog {
  id: string;
  dealer_id: string;
  staff_id: string | null;
  lead_id: string | null;
  action: AiAction;
  created_at: string;
}
