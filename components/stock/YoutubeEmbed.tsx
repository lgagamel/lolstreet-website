"use client";

interface YoutubeEmbedProps {
    embedUrl: string;
}

export default function YoutubeEmbed({ embedUrl }: YoutubeEmbedProps) {
    if (!embedUrl) return null;

    return (
        <div className="w-full mx-auto mb-8">
            <div className="relative w-full rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-900 dark:border-gray-800 bg-black aspect-video">
                {/* 
                   Aspect Ratio Note: 
                   Shorts are 9:16 (vertical). Standard videos are 16:9.
                   To play it safe and support both nicely without massive black bars taking up wrong space:
                   If we know it's a short, we might prefer 9:16 container. 
                   But the iframe usually handles fitting content (with black bars).
                   However, for "Shorts", user explicitly mentioned. 
                   Let's assume common case for Shorts is vertical intent.
                   For a mixed dashboard, a tall vertical video might take too much vertical scrolling space if full width.
                   
                   Design Choice:
                   Let's use a "mobile-like" container for Shorts if we can detect? 
                   We don't know strictly if it's a short from the *embed URL* alone (it's just embed/ID).
                   But the source URL had /shorts/.
                   
                   Safe default: Standard video aspect (16:9) is safer for desktop layouts usually. 
                   But if user emphasized shorts...
                   Let's make it fixed height or max-height to not dominate the screen?
                   Or just use a standard responsive video container.
                   
                   Let's try a unique design: "Phone" frame? Or just clean rounded.
                   Let's stick to a max-width container (max-w-md or lg) and allow it to be tall if needed?
                   Actually, responsive 16:9 is standard.
                   If we put a vertical video in 16:9, it has pillarboxes.
                   If we put 16:9 video in 9:16, it's tiny.
                   
                   Let's use a flexible container.
                */}
                <iframe
                    src={embedUrl}
                    title="YouTube video player"
                    className="absolute top-0 left-0 w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                />
            </div>
            <div className="text-center mt-2">
                <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold flex items-center justify-center gap-1">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                    Featured Story
                </p>
            </div>
        </div>
    );
}
