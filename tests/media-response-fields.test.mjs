import assert from "node:assert/strict";
import test from "node:test";

process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_KEY = "sb_publishable_test-business-data";

const { getMedia, uploadMedia } = await import("../dist/services/media.service.js");

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Content-Range": "0-0/1" },
});

test("media list and upload responses omit storage internals and retain signed URLs and media fields", async () => {
    const originalFetch = globalThis.fetch;
    const storedMedia = {
        media_id: 12,
        hotel_id: 7,
        image_type: "JPG",
        storage_bucket: "reservation-media",
        storage_path: "hotels/7/existing.jpg",
        file_size: 2,
        is_primary: true,
        display_order: 0,
        created_at: "2026-11-04T00:00:00.000Z",
    };

    globalThis.fetch = async (input, init = {}) => {
        const url = new URL(String(input));
        const method = String(init.method ?? "GET").toUpperCase();
        if (url.pathname === "/rest/v1/hotel" && method === "GET") return jsonResponse({ hotel_id: 7 });
        if (url.pathname === "/rest/v1/media" && method === "GET") {
            return url.searchParams.get("select") === "*" ? jsonResponse([storedMedia]) : jsonResponse([]);
        }
        if (url.pathname.startsWith("/storage/v1/object/sign/")) {
            return jsonResponse({ signedURL: `${url.pathname}?token=signed` });
        }
        if (url.pathname.startsWith("/storage/v1/object/reservation-media/") && method === "POST") return jsonResponse({});
        if (url.pathname === "/rest/v1/media" && method === "PATCH") return new Response(null, { status: 204 });
        if (url.pathname === "/rest/v1/media" && method === "POST") {
            return jsonResponse({ media_id: 13, hotel_id: 7, ...JSON.parse(String(init.body)), created_at: "2026-11-04T00:00:01.000Z" }, 201);
        }
        throw new Error(`Unexpected ${method} ${url.pathname}`);
    };

    try {
        const [listed] = await getMedia("hotel", 7);
        const uploaded = await uploadMedia("hotel", 7, {
            buffer: Buffer.from([0xff, 0xd8]),
            mimetype: "image/jpeg",
            size: 2,
        });

        for (const media of [listed, uploaded]) {
            assert.equal(Object.hasOwn(media, "storage_bucket"), false);
            assert.equal(Object.hasOwn(media, "storage_path"), false);
            assert.match(media.url, /token=signed/);
            assert.equal(media.image_type, "JPG");
            assert.equal(media.file_size, 2);
            assert.equal(media.is_primary, true);
            assert.equal(media.display_order, 0);
        }
        assert.equal(listed.media_id, 12);
        assert.equal(uploaded.media_id, 13);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
