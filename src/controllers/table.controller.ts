import type { Request, Response } from "express";
import { createTable, deleteTable, getTableById, getTables, updateTable } from "../services/table.service.js";

export const getTablesController = async (req: Request, res: Response) => {
    try {
        const tables = await getTables({
            status: req.query.status?.toString()
        });

        res.json(tables);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve tables",
            error: error
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
            message: "Failed to retrieve table",
            error: error
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
            message: "Failed to create table",
            error: error
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
            message: "Failed to update table",
            error: error
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
            message: "Failed to delete table",
            error: error
        });
    }
};
