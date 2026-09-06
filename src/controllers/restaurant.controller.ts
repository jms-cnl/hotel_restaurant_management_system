import type { Request, Response } from "express";
import {
    getRestaurants,
    getRestaurantById,
    createRestaurant,
    updateRestaurant,
    deleteRestaurant
} from "../services/restaurant.service.js";

export const getRestaurantsController = async (req: Request, res: Response) => {
    try {
        const restaurants = await getRestaurants({
            search: req.query.search?.toString()
        });

        res.json(restaurants);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve restaurants",
            error: error
        });
    }
};

export const getRestaurantByIdController = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const restaurant = await getRestaurantById(id);

        res.json(restaurant);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve restaurant",
            error: error
        });
    }
};

export const createRestaurantController = async (req: Request, res: Response) => {
    try {
        const restaurant = await createRestaurant(req.body);

        res.status(201).json(restaurant);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create restaurant",
            error: error
        });
    }
};

export const updateRestaurantController = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);
        const restaurant = await updateRestaurant(id, req.body);

        res.json(restaurant);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update restaurant",
            error: error
        });
    }
};

export const deleteRestaurantController = async (req: Request, res: Response) => {
    try {
        const id = Number(req.params.id);

        await deleteRestaurant(id);

        res.status(204).send();
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete restaurant",
            error: error
        });
    }
};
