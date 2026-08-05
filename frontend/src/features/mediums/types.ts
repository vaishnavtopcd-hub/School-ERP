export interface Medium {
  id: string;
  name: string;
  isActive: boolean;
  schoolId: string;
  /** Sections currently taught in this medium. Blocks deletion when non-zero. */
  sectionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MediumInput {
  name: string;
  isActive: boolean;
}
