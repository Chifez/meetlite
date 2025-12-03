export type Team = {
  id: string;
  name: string;
  slug?: string;
  logo?: string;
  members: any[];
  memberCount?: number;
  role?: 'owner' | 'member';
  createdAt?: string;
};
