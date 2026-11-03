import type { Request, Response } from "express";
import { getOccupancyReport, getReservationReport, getRevenueReport, getTableReport, parseReportFilters, ReportError } from "../services/report.service.js";

const handleReportError = (res: Response, error: unknown, message: string) => {
    if (error instanceof ReportError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
    }
    console.error(error);
    res.status(500).json({ message });
};

export const getReservationReportController = async (req: Request, res: Response) => {
    try {
        const report = await getReservationReport(parseReportFilters(req.query as Record<string, unknown>), req);

        res.json(report);
    } catch (error) {
        handleReportError(res, error, "Failed to retrieve reservation report");
    }
};

export const getRevenueReportController = async (req: Request, res: Response) => {
    try {
        const report = await getRevenueReport(parseReportFilters(req.query as Record<string, unknown>));

        res.json(report);
    } catch (error) {
        handleReportError(res, error, "Failed to retrieve revenue report");
    }
};

export const getOccupancyReportController = async (req: Request, res: Response) => {
    try {
        const report = await getOccupancyReport(parseReportFilters(req.query as Record<string, unknown>));

        res.json(report);
    } catch (error) {
        handleReportError(res, error, "Failed to retrieve occupancy report");
    }
};

export const getTableReportController = async (req: Request, res: Response) => {
    try {
        res.json(await getTableReport(parseReportFilters(req.query as Record<string, unknown>), req));
    } catch (error) {
        handleReportError(res, error, "Failed to retrieve table report");
    }
};
