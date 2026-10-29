import { AuditLog } from './audit-log.model.js';
import { AuthToken } from './auth-token.model.js';
import { Category } from './category.model.js';
import { ItemVariant } from './item-variant.model.js';
import { ItemView } from './item-view.model.js';
import { Membership } from './membership.model.js';
import { MenuItem } from './menu-item.model.js';
import { Order } from './order.model.js';
import { OrderItem } from './order-item.model.js';
import { Payment } from './payment.model.js';
import { PosJob } from './pos-job.model.js';
import { Promotion } from './promotion.model.js';
import { Restaurant } from './restaurant.model.js';
import { RestaurantTable } from './restaurant-table.model.js';
import { ScanEvent } from './scan-event.model.js';
import { ServiceRequest } from './service-request.model.js';
import { TeamInvite } from './team-invite.model.js';
import { User } from './user.model.js';

export {
  AuditLog,
  AuthToken,
  Category,
  ItemVariant,
  ItemView,
  Membership,
  MenuItem,
  Order,
  OrderItem,
  Payment,
  PosJob,
  Promotion,
  Restaurant,
  RestaurantTable,
  ScanEvent,
  ServiceRequest,
  TeamInvite,
  User,
};

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
  Order,
  OrderItem,
  ServiceRequest,
  Payment,
  PosJob,
  TeamInvite,
  AuditLog,
  Promotion,
];
