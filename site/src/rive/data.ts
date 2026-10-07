// Données de la démo Rive Drive (location de voitures, Paris & banlieue). Tout est inventé.

export type Theme = 'premium' | 'street';

export interface Agency {
  id: string;
  name: string;
  address: string;
  hours: string;
  /** Heure d'ouverture / de fermeture (lun-sam). */
  open: number;
  close: number;
}

export interface Category {
  id: string;
  name: string;
  example: string;
  price: number;
  seats: number;
  bags: number;
  gearbox: string;
  fuel: string;
  /** Nombre de véhicules de la catégorie par agence. */
  stock: number;
}

export interface Option {
  id: string;
  name: string;
  desc: string;
  price: number;
}

export const AGENCIES: Agency[] = [
  { id: 'paris11', name: 'Paris 11e', address: '12 rue de la Roquette, 75011 Paris', hours: 'Lun–sam 8h–20h · dim 9h–18h', open: 8, close: 20 },
  { id: 'saintdenis', name: 'Saint-Denis', address: '8 avenue Jules-Rimet, 93200 Saint-Denis', hours: 'Lun–sam 7h–21h · dim 8h–19h', open: 7, close: 21 },
  { id: 'creteil', name: 'Créteil', address: '45 av. du Général-de-Gaulle, 94000 Créteil', hours: 'Lun–sam 8h–20h · dim 9h–18h', open: 8, close: 20 },
  { id: 'defense', name: 'La Défense', address: '7 esplanade du Général-de-Gaulle, 92800 Puteaux', hours: 'Lun–sam 7h–22h · dim 8h–20h', open: 7, close: 22 },
  { id: 'orly', name: 'Orly', address: 'Aéroport d’Orly, Terminal 1, 94390 Orly', hours: 'Tous les jours 6h–23h', open: 6, close: 23 }
];

export const CATEGORIES: Category[] = [
  { id: 'citadine', name: 'Citadine', example: 'type Clio, 208', price: 29, seats: 5, bags: 2, gearbox: 'Manuelle', fuel: 'Essence', stock: 7 },
  { id: 'suv', name: 'SUV compact', example: 'type 2008, Captur', price: 45, seats: 5, bags: 3, gearbox: 'Automatique', fuel: 'Hybride', stock: 5 },
  { id: 'berline', name: 'Berline', example: 'type 508, Passat', price: 49, seats: 5, bags: 4, gearbox: 'Automatique', fuel: 'Diesel', stock: 4 },
  { id: 'familiale', name: 'Familiale 7 places', example: 'type Rifter, Touran', price: 69, seats: 7, bags: 5, gearbox: 'Manuelle', fuel: 'Diesel', stock: 3 },
  { id: 'utilitaire', name: 'Utilitaire', example: 'type Kangoo, 6 m³', price: 79, seats: 3, bags: 0, gearbox: 'Manuelle', fuel: 'Diesel', stock: 3 }
];

export const OPTIONS: Option[] = [
  { id: 'siege', name: 'Siège bébé', desc: 'Siège auto adapté à l’âge de l’enfant, installé avant le départ.', price: 5 },
  { id: 'conducteur', name: 'Conducteur additionnel', desc: 'Partagez le volant, le second conducteur est assuré.', price: 8 },
  { id: 'km', name: 'Kilométrage illimité', desc: 'Sans option : 200 km inclus par jour, puis 0,25 €/km.', price: 10 },
  { id: 'franchise', name: 'Franchise réduite', desc: 'Franchise ramenée de 1 200 € à 150 € en cas de dommage.', price: 12 }
];

/** Heures proposées pour le départ et le retour. */
export const HOURS = [7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22];
export const DAYS_AHEAD = 60;
export const MAX_DAYS = 30;
