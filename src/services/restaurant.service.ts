import { supabase } from "../config/supabase.js";
import { deleteMediaForEntity } from "./media.service.js";

export class RestaurantError extends Error {
    constructor(message: string, public readonly statusCode = 400) {
        super(message);
        this.name = "RestaurantError";
    }
}

export const getRestaurants = async (filters: { search?: string | undefined }) => {
    let query = supabase
        .from("restaurant")
        .select("*");

    if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,address.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data;
};

export const getRestaurantById = async (id: number) => {
    const { data, error } = await supabase
        .from("restaurant")
        .select("*")
        .eq("restaurant_id", id)
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const createRestaurant = async (restaurant: {
    name: string;
    address: string;
    description?: string;
    contact_number: string;
    email?: string;
    status: string;
    hotel_id?: number;
}) => {
    if (restaurant.hotel_id !== undefined && (!Number.isInteger(restaurant.hotel_id) || restaurant.hotel_id <= 0)) {
        throw new RestaurantError("hotel_id must be a positive integer");
    }

    let hotelId = restaurant.hotel_id;
    if (hotelId === undefined) {
        const { data: hotels, error: hotelsError } = await supabase.from("hotel").select("hotel_id");
        if (hotelsError) throw hotelsError;
        if (hotels?.length !== 1) throw new RestaurantError("hotel_id is required unless exactly one hotel exists");
        hotelId = hotels[0]?.hotel_id;
    } else {
        const { data: hotels, error: hotelError } = await supabase.from("hotel").select("hotel_id").eq("hotel_id", hotelId);
        if (hotelError) throw hotelError;
        if (!hotels?.length) throw new RestaurantError("hotel_id does not exist");
    }

    if (hotelId === undefined || hotelId === null) throw new RestaurantError("hotel_id is required");
    const { hotel_id: _requestedHotelId, ...restaurantFields } = restaurant;
    const { data, error } = await supabase
        .from("restaurant")
        .insert({ ...restaurantFields, hotel_id: hotelId })
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const updateRestaurant = async (
    id: number,
    restaurant: {
        name?: string;
        address?: string;
        description?: string;
        contact_number?: string;
        email?: string;
        status?: string;
    }
) => {
    if (Object.hasOwn(restaurant, "hotel_id")) throw new RestaurantError("hotel_id cannot be changed");
    const { data, error } = await supabase
        .from("restaurant")
        .update(restaurant)
        .eq("restaurant_id", id)
        .select()
        .single();

    if (error) {
        throw error;
    }

    return data;
};

export const deleteRestaurant = async (id: number) => {
    await deleteMediaForEntity("restaurant", id);
    const { error } = await supabase
        .from("restaurant")
        .delete()
        .eq("restaurant_id", id);

    if (error) {
        throw error;
    }
};
