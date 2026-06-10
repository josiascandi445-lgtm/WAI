import yts from "yt-search";
import ytdl from "ytdl-core";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegPath);

export default async function music(sock, msg, args) {
    const text = args.join(" ");
    if (!text) {
        return sock.sendMessage(msg.key.remoteJid, {
            text: "❌ Usa assim: .music nome da música"
        });
    }

    try {
        // 1. Search
        const search = await yts(text);
        const video = search.videos[0];

        if (!video) {
            return sock.sendMessage(msg.key.remoteJid, {
                text: "❌ Não encontrei nada."
            });
        }

        const url = video.url;

        const fileName = `music_${Date.now()}.mp3`;
        const filePath = path.resolve("./tmp", fileName);

        if (!fs.existsSync("./tmp")) fs.mkdirSync("./tmp");

        // 2. Download + convert
        const stream = ytdl(url, {
            filter: "audioonly",
            quality: "highestaudio"
        });

        ffmpeg(stream)
            .audioBitrate(128)
            .save(filePath)
            .on("end", async () => {

                const audio = fs.readFileSync(filePath);

                await sock.sendMessage(msg.key.remoteJid, {
                    audio: audio,
                    mimetype: "audio/mp4",
                    ptt: true // voice note style
                });

                fs.unlinkSync(filePath);
            });

    } catch (err) {
        console.log("music error:", err);

        sock.sendMessage(msg.key.remoteJid, {
            text: "💥 Erro ao baixar música."
        });
    }
}
