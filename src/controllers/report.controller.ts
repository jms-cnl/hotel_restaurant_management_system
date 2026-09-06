import type { Request, Response } from "express";
import { getOccupancyReport, getReservationReport, getRevenueReport } from "../services/report.service.js";

export const getReservationReportController = async (req: Request, res: Response) => {
    try {
        const report = await getReservationReport({
            status: req.query.status?.toString(),
            type: req.query.type?.toString()
        });

        res.json(report);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve reservation report",
            error: error
        });
    }
};

export const getRevenueReportController = async (_req: Request, res: Response) => {
    try {
        const report = await getRevenueReport();

        res.json(report);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve revenue report",
            error: error
        });
    }
};

export const getOccupancyReportController = async (_req: Request, res: Response) => {
    try {
        const report = await getOccupancyReport();

        res.json(report);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Failed to retrieve occupancy report",
            error: error
        });
    }
};
