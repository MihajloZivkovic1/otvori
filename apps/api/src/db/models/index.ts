import { AuthToken } from './auth-token.model.js';
import { Category } from './category.model.js';
import { ItemVariant } from './item-variant.model.js';
import { ItemView } from './item-view.model.js';
import { Membership } from './membership.model.js';
import { MenuItem } from './menu-item.model.js';
import { Restaurant } from './restaurant.model.js';
import { RestaurantTable } from './restaurant-table.model.js';
import { ScanEvent } from './scan-event.model.js';
import { User } from './user.model.js';

export { AuthToken, Category, ItemVariant, ItemView, Membership, MenuItem, Restaurant, RestaurantTable, ScanEvent, User };

export const allModels = [
  Restaurant,
  User,
  Membership,
  AuthToken,
  Category,
  MenuItem,
  ItemVariant,
  RestaurantTable,
  ScanEvent,
  ItemView,
];
