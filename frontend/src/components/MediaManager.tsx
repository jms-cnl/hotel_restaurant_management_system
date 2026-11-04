import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiDelete, apiGet, apiPatch, apiUpload } from "../api";
import type { Media } from "../types";

type MediaEntityType = "hotel" | "restaurant" | "room" | "table";

export function MediaManager({ entityType, entityId, manager }: { entityType: MediaEntityType; entityId: number; manager: boolean }) {
    const [items, setItems] = useState<Media[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const refreshedMediaIds = useRef(new Set<number>());
    const refreshing = useRef(false);
    const endpoint = `/media/${entityType}/${entityId}`;

    const load = async () => {
        try {
            setItems(await apiGet<Media[]>(endpoint));
            setError("");
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Unable to load images");
        }
    };

    useEffect(() => {
        refreshedMediaIds.current.clear();
        setError("");
        setMessage("");
        void load();
    }, [entityType, entityId]);

    const refreshExpiredUrl = async (mediaId: number) => {
        if (refreshedMediaIds.current.has(mediaId) || refreshing.current) return;
        refreshedMediaIds.current.add(mediaId);
        refreshing.current = true;
        try {
            await load();
        } finally {
            refreshing.current = false;
        }
    };

    const upload = async (event: FormEvent) => {
        event.preventDefault();
        if (!file) return;
        setError("");
        try {
            await apiUpload(endpoint, file);
            setFile(null);
            setMessage("Image uploaded");
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Upload failed");
        }
    };

    const replace = async (mediaId: number, replacement: File | undefined) => {
        if (!replacement) return;
        try {
            await apiUpload(`/media/${mediaId}/file`, replacement, {}, "PUT");
            setMessage("Image replaced");
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Replace failed");
        }
    };

    const primary = async (mediaId: number) => {
        try {
            await apiPatch(`/media/${mediaId}/primary`, {});
            setMessage("Primary image updated");
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Primary image update failed");
        }
    };

    const reorder = async (media: Media, value: string) => {
        try {
            await apiPatch(`/media/${media.media_id}/order`, { display_order: Number(value) });
            setMessage("Image order updated");
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Order update failed");
        }
    };

    const remove = async (mediaId: number) => {
        if (!window.confirm("Delete this image?")) return;
        try {
            await apiDelete(`/media/${mediaId}`);
            setMessage("Image deleted");
            await load();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Delete failed");
        }
    };

    return <div className="media-manager">
        <h3>Images</h3>
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        {items.length ? <div className="media-grid">{items.map((media) => <div className="media-item" key={media.media_id}>
            <img src={media.url} alt={`${media.image_type} media`} onError={() => void refreshExpiredUrl(media.media_id)} />
            <div><strong>{media.is_primary ? "Primary image" : "Image"}</strong><span>Order: {media.display_order}</span></div>
            {manager && <div className="media-actions">
                <button type="button" onClick={() => void primary(media.media_id)} disabled={media.is_primary}>Set primary</button>
                <label>Replace<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void replace(media.media_id, event.target.files?.[0])} /></label>
                <label>Order<input type="number" min="0" defaultValue={media.display_order} onBlur={(event) => void reorder(media, event.target.value)} /></label>
                <button type="button" onClick={() => void remove(media.media_id)}>Delete</button>
            </div>}
        </div>)}</div> : <p className="empty">No images available.</p>}
        {manager && <form className="media-upload" onSubmit={(event) => void upload(event)}>
            <label>Upload image<input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
            <button type="submit">Upload</button>
        </form>}
    </div>;
}
