import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiGet } from "../api";
import type { Hotel } from "../types";

export function HotelDiscovery() {
    const [hotels, setHotels] = useState<Hotel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        apiGet<Hotel[]>("/hotels")
            .then((hotelRows) => { if (active) setHotels(hotelRows); })
            .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to load Maison Valment"); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    if (hotels.length) return <Navigate to={`/hotels/${hotels[0].hotel_id}`} replace />;
    return <main className="customer-discovery">
        <section className="hero customer-hero compact-hero">
            <p className="eyebrow">MAISON VALMENT</p>
            <h1>Stay with us</h1>
            {loading ? <p className="hero-description">Loading hotel details…</p> : error
                ? <div className="alert error customer-alert" role="alert">{error}</div>
                : <p className="hero-description">Maison Valment is not available right now. Please check back later.</p>}
        </section>
    </main>;
}
