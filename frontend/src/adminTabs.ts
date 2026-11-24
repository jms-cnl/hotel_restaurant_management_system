import { createElement, type ReactElement } from "react";
import { NavLink } from "react-router-dom";

export interface AdminTab {
    readonly label: string;
    readonly path: string;
    render(): ReactElement;
}

abstract class AdminRouteTab implements AdminTab {
    abstract readonly label: string;
    abstract readonly path: string;
    protected ariaLabel?: string;

    render(): ReactElement {
        return createElement(NavLink, {
            to: this.path,
            "aria-label": this.ariaLabel,
            key: this.path,
        }, this.label);
    }
}

export class DashboardTab extends AdminRouteTab {
    readonly label = "Dashboard";
    readonly path = "/dashboard";
}

export class ManageTab extends AdminRouteTab {
    readonly label = "Manage";
    readonly path = "/manage";
}

export class ReservationsTab extends AdminRouteTab {
    readonly label = "Reservations";
    readonly path = "/reservations";
}

export class CombinedBookingsTab extends AdminRouteTab {
    readonly label = "Combined Bookings";
    readonly path = "/combined-bookings";
}

export class PropertySettingsTab extends AdminRouteTab {
    readonly label = "Property settings";
    readonly path = "/hotels";
}

export class RestaurantsTab extends AdminRouteTab {
    readonly label = "Restaurants";
    readonly path = "/restaurants";
}

export class RoomsTab extends AdminRouteTab {
    readonly label = "Rooms";
    readonly path = "/rooms";
}

export class TablesTab extends AdminRouteTab {
    readonly label = "Tables";
    readonly path = "/tables";
}

export class AmenitiesTab extends AdminRouteTab {
    readonly label = "Amenities";
    readonly path = "/amenities";
}

export class UsersAndStaffAssignmentsTab extends AdminRouteTab {
    readonly label = "Users & Staff Assignments";
    readonly path = "/users";
}

export class ReportsTab extends AdminRouteTab {
    readonly label = "Reports";
    readonly path = "/reports";
}

export class NotificationsTab extends AdminRouteTab {
    readonly label = "🔔";
    readonly path = "/notifications";
    protected ariaLabel = "Notifications";
}

export const adminTabs: AdminTab[] = [
    new DashboardTab(),
    new ManageTab(),
    new ReservationsTab(),
    new CombinedBookingsTab(),
    new PropertySettingsTab(),
    new RestaurantsTab(),
    new RoomsTab(),
    new TablesTab(),
    new AmenitiesTab(),
    new UsersAndStaffAssignmentsTab(),
    new ReportsTab(),
    new NotificationsTab(),
];
