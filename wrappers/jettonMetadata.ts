import { createHash } from "crypto";
import { beginCell, Builder, Cell, Dictionary } from "@ton/core";

const ONCHAIN_CONTENT_PREFIX = 0x00;
const SNAKE_PREFIX = 0x00;
const CELL_MAX_SIZE_BYTES = Math.floor((1023 - 8) / 8);

export type JettonMetadataParams = {
    name: string;
    symbol: string;
    description: string;
    decimals: string;
    image: string;
};

function bufferToChunks(buff: Buffer, chunkSize: number): Buffer[] {
    const chunks: Buffer[] = [];
    let rest = buff;
    while (rest.byteLength > 0) {
        chunks.push(rest.subarray(0, chunkSize));
        rest = rest.subarray(chunkSize);
    }
    return chunks;
}

/** Snake-format cell used by TEP-64 string values. */
export function makeSnakeCell(data: Buffer): Cell {
    const chunks = bufferToChunks(data, CELL_MAX_SIZE_BYTES);
    if (chunks.length === 0) {
        return beginCell().storeUint(SNAKE_PREFIX, 8).endCell();
    }

    const builder = chunks.reduceRight((cur: Builder, chunk: Buffer, index: number) => {
        if (index === 0) {
            cur.storeUint(SNAKE_PREFIX, 8);
        }
        cur.storeBuffer(chunk);
        if (index > 0) {
            return beginCell().storeRef(cur.endCell());
        }
        return cur;
    }, beginCell());

    return builder.endCell();
}

function toKey(key: string): bigint {
    const hash = createHash("sha256").update(key).digest();
    return BigInt("0x" + hash.toString("hex"));
}

/**
 * TEP-64 on-chain content (0x00 + dict).
 * Deploy with this so wallets/explorers show name/symbol without hosting a URL.
 */
export function buildOnchainMetadata(data: JettonMetadataParams): Cell {
    const dict = Dictionary.empty(Dictionary.Keys.BigUint(256), Dictionary.Values.Cell());
    for (const [key, value] of Object.entries(data)) {
        dict.set(toKey(key), makeSnakeCell(Buffer.from(value, "utf8")));
    }
    return beginCell().storeUint(ONCHAIN_CONTENT_PREFIX, 8).storeDict(dict).endCell();
}

/**
 * TEP-64 off-chain content (0x01 + ASCII URI).
 * Use after hosting metadata/awn.json on IPFS/HTTPS, then UpdateContent.
 */
export function buildOffchainMetadata(uri: string): Cell {
    return beginCell().storeUint(0x01, 8).storeBuffer(Buffer.from(uri, "ascii")).endCell();
}

export const DEFAULT_AWN_METADATA: JettonMetadataParams = {
    name: "AwanToken",
    symbol: "AWN",
    description:
        "AwanToken ($AWN) — TON jetton with DEX limits, sell-tax treasury and weekly GRAM claims.",
    decimals: "9",
    /** Hosted on Vercel miniapp — must stay public (no auth gate). */
    image: "https://awn-miniapp-vercel.vercel.app/awn-logo.png",
};
