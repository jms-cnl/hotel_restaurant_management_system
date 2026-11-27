import type { ReactNode } from "react";

export function Page({ title, children, error, loading }: { title: string; children: ReactNode; error?: string; loading?: boolean }) {
    return <section><div className="page-heading"><h1>{title}</h1></div>{error && <div className="alert error">{error}</div>}{loading ? <p>Loading...</p> : children}</section>;
}
