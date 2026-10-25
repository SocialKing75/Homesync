// Point de composition unique. Remplacer l'adaptateur après accord sur le
// contrat du backend ; aucune API ni authentification nouvelle ici.
export { demoServices as dataServices } from './demo'
export { getListings, getListing, catalogService } from './catalog'
export type * from './contracts'
