import type { Request, Response } from "express";
import {  getTables, 
    getTableById, 
    createTable, 
    updateTable, 
    deleteTable} from "../services/table.service.js";

export const getTablesController = async (req: Request, res: Response) => {
    try {
        const tables = await getTables({
            status: req.query.status?.toString()
        });

        res.json(tables);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve tables"
        });
    }
};

export const getTableByIdController = async (req: Request, res: Response) => {
    try {
        const table = await getTableById(Number(req.params.id));

        res.json(table);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve table"
        });
    }
};

export const createTableController = async (req: Request, res: Response) => {
    try {
        const table = await createTable(req.body);

        res.status(201).json(table);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to create table"
        });
    }
};

export const updateTableController = async (req: Request, res: Response) => {
    try {
        const table = await updateTable(Number(req.params.id), req.body);

        res.json(table);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to update table"
        });
    }
};

export const deleteTableController = async (req: Request, res: Response) => {
    try {
        await deleteTable(Number(req.params.id));

        res.status(204).send();
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to delete table"
        });
    }
};
