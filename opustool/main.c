#include <errno.h>
#include <limits.h>
#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include <ogg/ogg.h>
#include <opus.h>

static const char kUsage[] =
    "usage: opustool <data> <script> <out>\n"
    "\n"
    "options:\n"
    "    <data>\n"
    "        Raw audio data. Must be 48 kHz, mono, 32-bit float.\n"
    "\n"
    "    <script>\n"
    "        Script for creating an Opus file from the audio data.\n"
    "\n"
    "    <out>\n"
    "        Output Opus file.\n";

#define die(...) die_func(__FILE__, __LINE__, __VA_ARGS__)

static void die_func(const char *file, int line, int ecode, const char *fmt,
                     ...) __attribute__((noreturn, format(printf, 4, 5)));

static char *quote(const char *str);

static const char *gFile;
static int gLineno;

static void die_func(const char *file, int line, int ecode, const char *fmt,
                     ...) {
    fputs("error", stderr);
    if (file != NULL) {
        fprintf(stderr, ": (%s:%d)", file, line);
    }
    if (gFile != NULL) {
        fprintf(stderr, ": %s", quote(gFile));
        if (gLineno != 0)
            fprintf(stderr, ":%d", gLineno);
    }
    if (fmt != NULL) {
        fputs(": ", stderr);
        va_list ap;
        va_start(ap, fmt);
        vfprintf(stderr, fmt, ap);
        va_end(ap);
    }
    if (ecode != 0) {
        fputs(": ", stderr);
        fputs(strerror(ecode), stderr);
    }
    fputc('\n', stderr);
    exit(1);
}

static char *quote(const char *str) {
    char *r = malloc(strlen(str) * 4 + 3);
    if (r == NULL)
        die(errno, "quote");
    char *op = r;
    const char *ip = str;
    *op++ = '"';
    int c;
    while ((c = (unsigned char)*ip++) != '\0') {
        if (c >= 32 && c <= 126) {
            if (c == '"' || c == '\\')
                *op++ = '\\';
            *op++ = c;
            continue;
        }
        *op++ = '\\';
        switch (c) {
        case '\n':
            *op++ = 'n';
            break;
        case '\r':
            *op++ = 'r';
            break;
        case '\t':
            *op++ = 't';
            break;
        default:
            *op++ = '0' + (c >> 6);
            *op++ = '0' + ((c >> 3) & 7);
            *op++ = '0' + (c & 7);
            break;
        }
    }
    *op++ = '"';
    *op++ = '\0';
    return r;
}

// =============================================================================

static float *gAudioData;
static int gAudioLength;

static void read_data(const char *fname) {
    gFile = fname;
    FILE *fp = fopen(fname, "rb");
    if (fp == NULL) {
        die(errno, "could not open file");
    }
    char *buf = NULL;
    size_t sz = 0, alloc = 0;
    while (true) {
        if (sz == alloc) {
            size_t nalloc = alloc * 2;
            if (alloc == 0)
                nalloc = 4096;
            char *nbuf = realloc(buf, nalloc);
            if (!nbuf)
                die(errno, "could not read file");
            buf = nbuf;
            alloc = nalloc;
        }
        size_t amt = fread(buf + sz, 1, alloc - sz, fp);
        if (amt == 0) {
            if (ferror(fp))
                die(errno, "could not read file");
            break;
        }
        sz += amt;
    }
    fclose(fp);
    gAudioData = (void *)buf;
    gAudioLength = (int)(sz / sizeof(float));
    gFile = NULL;
}

// =============================================================================

enum {
    kMaxFields = 3,
};

static int parse_fields(char *fields[kMaxFields], char *text) {
    char *p = text;
    while (*p != '\0' && *p != '\n')
        p++;
    *p = '\0';
    p = text;
    for (int i = 0; i < kMaxFields; i++) {
        while (*p == ' ')
            p++;
        if (*p == '\0')
            return i;
        fields[i] = p;
        while (*p != ' ' && *p != '\0')
            p++;
        if (*p == ' ') {
            *p = '\0';
            p++;
        }
    }
    return kMaxFields;
}

// =============================================================================

static const unsigned kPacketLengths[] = {
    120,  // 2.5 ms
    240,  // 5 ms
    480,  // 10 ms
    960,  // 20 ms
    1920, // 40 ms
    2880, // 60 ms
};

// check_packet_length fails if length is not a valid sample length for an Opus
// packet.
static void check_packet_length(unsigned long length) {
    int n = sizeof(kPacketLengths) / sizeof(*kPacketLengths);
    for (int i = 0; i < n; i++) {
        if (kPacketLengths[i] == length)
            return;
    }
    die(0, "invalid packet length %lu", length);
}

// =============================================================================

struct bandwidth {
    char name[4];
    int value;
};

static const struct bandwidth kBandwidths[] = {
    {"NB", OPUS_BANDWIDTH_NARROWBAND},     //
    {"MB", OPUS_BANDWIDTH_MEDIUMBAND},     //
    {"WB", OPUS_BANDWIDTH_WIDEBAND},       //
    {"SWB", OPUS_BANDWIDTH_SUPERWIDEBAND}, //
    {"FB", OPUS_BANDWIDTH_FULLBAND},       //
};

static int parse_bandwidth(const char *bw) {
    int n = sizeof(kBandwidths) / sizeof(*kBandwidths);
    for (int i = 0; i < n; i++) {
        if (strcmp(kBandwidths[i].name, bw) == 0)
            return kBandwidths[i].value;
    }
    die(0, "invalid bandwidth %s, expected NB, MB, WB, SWB, or FB", quote(bw));
    return 0;
}

// =============================================================================

// A packet is an encoded Opus packet.
struct packet {
    int nsamples;  // Number of audio samples in the packet.
    size_t offset; // Byte offset into raw data where encoded packet is stored.
    size_t length; // Encoded length in bytes.
};

// The packets in the Opus stream.
static struct packet *gPacketData;
static size_t gPacketSize, gPacketAlloc;

// add_packet adds a packet to the end of the packet stream.
static void add_packet(struct packet p) {
    if (gPacketSize >= gPacketAlloc) {
        size_t nalloc = gPacketAlloc * 2;
        if (nalloc == 0)
            nalloc = 32;
        struct packet *arr = realloc(gPacketData, nalloc * sizeof(*arr));
        if (arr == NULL)
            die(0, NULL);
        gPacketData = arr;
        gPacketAlloc = nalloc;
    }
    gPacketData[gPacketSize] = p;
    gPacketSize++;
}

// Raw data contained in the packets.
static char *gRawData;
static size_t gRawSize, gRawAlloc;

// get_buffer returns a buffer where encoded packet data can be written to with
// size at least sz bytes.
static void *get_buffer(size_t sz) {
    if (sz > gRawAlloc - gRawSize) {
        size_t nalloc = gRawAlloc * 2;
        if (nalloc == 0)
            nalloc = 4096;
        while (sz > nalloc - gRawSize)
            nalloc *= 2;
        void *nbuf = realloc(gRawData, nalloc);
        if (nbuf == NULL)
            die(errno, NULL);
        gRawData = nbuf;
        gRawAlloc = nalloc;
    }
    return gRawData + gRawSize;
}

// write_packet writes a new packet containing sz bytes from the last call to
// get_buffer.
static void write_packet(int nsamples, size_t sz) {
    add_packet((struct packet){
        .nsamples = nsamples,
        .offset = gRawSize,
        .length = sz,
    });
    gRawSize += sz;
}

// The order that the packets appear in the opus stream.
static int *gOrderData;
static size_t gOrderSize, gOrderAlloc;

// emit_packet adds a packet to the output.
static void emit_packet(int idx) {
    if (gOrderSize >= gOrderAlloc) {
        size_t nalloc = gOrderAlloc * 2;
        if (nalloc == 0)
            nalloc = 32;
        int *nbuf = realloc(gOrderData, nalloc * sizeof(*nbuf));
        if (nbuf == NULL)
            die(errno, NULL);
        gOrderData = nbuf;
        gOrderAlloc = nalloc;
    }
    gOrderData[gOrderSize] = idx;
    gOrderSize++;
}

// =============================================================================

enum state {
    kStateInitial,
    kStateAudio,
};

static void check_args(int nfields, int want) {
    int got = nfields - 1;
    if (got != want)
        die(0, "got %d arguments, expected %d", got, want);
}

static void run_script(const char *fname) {
    gFile = fname;
    gLineno = 0;
    FILE *fp = fopen(fname, "r");
    if (fp == NULL)
        die(errno, "could not open file");
    // Line of text.
    char line[256];
    // Audio data for packet.
    const float *audio_data = NULL;
    int audio_length = 0;
    int bitrate = 0;     // OPUS_SET_BITRATE
    int bandwidth = 0;   // OPUS_SET_BANDWIDTH
    int independent = 0; // OPUS_SET_PREDICTION_DISABLED
    enum state state = kStateInitial;
    int opus_error;
    OpusEncoder *enc =
        opus_encoder_create(48000, 1, OPUS_APPLICATION_AUDIO, &opus_error);
    if (enc == NULL)
        die(0, "could not create Opus encoder: %s", opus_strerror(opus_error));
    while (fgets(line, sizeof(line), fp)) {
        gLineno++;
        char *fields[kMaxFields];
        int nfields = parse_fields(fields, line);
        if (nfields == 0)
            continue;
        if (strcmp(fields[0], "audio") == 0) {
            check_args(nfields, 2);
            if (state != kStateInitial)
                die(0, "unexpected audio command");
            char *e;
            unsigned long offset = strtoul(fields[1], &e, 10);
            if (*e != '\0')
                die(0, "invalid offset");
            unsigned long length = strtoul(fields[2], &e, 10);
            if (*e != '\0')
                die(0, "invalid length");
            unsigned long alen = (unsigned long)gAudioLength;
            if (offset > alen || length > alen - offset)
                die(0, "audio out of range");
            check_packet_length(length);
            audio_data = gAudioData + offset;
            audio_length = length;
            bitrate = 6000;
            bandwidth = OPUS_BANDWIDTH_NARROWBAND;
            independent = 0;
            state = kStateAudio;
        } else if (strcmp(fields[0], "bitrate") == 0) {
            check_args(nfields, 1);
            if (state != kStateAudio)
                die(0, "unexpected bitrate command");
            char *e;
            unsigned long n = strtoul(fields[1], &e, 10);
            if (*e != '\0')
                die(0, "invalid bitrate: got %s, expected integer",
                    quote(fields[1]));
            if (n < 1 || n > INT_MAX)
                die(0, "bitrate out of range: %lu", n);
            bitrate = n;
        } else if (strcmp(fields[0], "bandwidth") == 0) {
            check_args(nfields, 1);
            if (state != kStateAudio)
                die(0, "unexpected bandwidth command");
            bandwidth = parse_bandwidth(fields[1]);
        } else if (strcmp(fields[0], "independent") == 0) {
            check_args(nfields, 0);
            if (state != kStateAudio)
                die(0, "unexpected independent command");
            independent = 1;
        } else if (strcmp(fields[0], "end") == 0) {
            check_args(nfields, 0);
            if (state != kStateAudio)
                die(0, "unexpected end command");
            opus_encoder_ctl(enc, OPUS_SET_BITRATE(bitrate));
            opus_encoder_ctl(enc, OPUS_SET_BANDWIDTH(bandwidth));
            opus_encoder_ctl(enc, OPUS_SET_PREDICTION_DISABLED(independent));
            size_t bufsz = 4096;
            void *buf = get_buffer(bufsz);
            int plen =
                opus_encode_float(enc, audio_data, audio_length, buf, bufsz);
            if (plen < 0)
                die(0, "could not encode Opus data: %s", opus_strerror(plen));
            write_packet(audio_length, plen);
            state = kStateInitial;
        } else if (strcmp(fields[0], "emit") == 0) {
            check_args(nfields, 1);
            if (state != kStateInitial)
                die(0, "unexpected emit command");
            char *e;
            unsigned long n = strtoul(fields[1], &e, 10);
            if (*e != '\0')
                die(0, "invalid copy index: got %s, expected integer",
                    quote(fields[1]));
            if (n > gPacketSize)
                die(0, "copy index out of range");
            emit_packet(n);
        } else {
            die(0, "unknown command %s", quote(fields[0]));
        }
    }
    if (ferror(fp)) {
        die(errno, "could not read file");
    }
    gLineno++;
    switch (state) {
    case kStateInitial:
        break;
    case kStateAudio:
        die(0, "expected end command");
    }
    fclose(fp);
    opus_encoder_destroy(enc);
    gFile = NULL;
    gLineno = 0;
}

// =============================================================================

static void write16(char *p, unsigned x) {
    p[0] = x;
    p[1] = x >> 8;
}

static void write32(char *p, unsigned x) {
    p[0] = x;
    p[1] = x >> 8;
    p[2] = x >> 16;
    p[3] = x >> 24;
}

static void write_opus_head(ogg_stream_state *os) {
    char buf[19];
    memcpy(&buf[0], "OpusHead", 8); // Magic
    buf[8] = 1;                     // Version
    buf[9] = 1;                     // Channel count
    write16(&buf[10], 0);           // Preskip
    write32(&buf[12], 0);           // Sample rate
    write16(&buf[16], 0);           // Gain
    buf[18] = 0;                    // Mapping family
    ogg_packet packet = {
        .packet = (unsigned char *)buf,
        .bytes = sizeof(buf),
        .b_o_s = 1,
    };
    int r = ogg_stream_packetin(os, &packet);
    if (r != 0)
        die(0, "could not write Opus header");
}

static void write_opus_tags(ogg_stream_state *os) {
    char buf[16];
    memcpy(&buf[0], "OpusTags", 8); // Magic
    write32(&buf[8], 0);            // Vendor string length
    write32(&buf[12], 0);           // User comment list length
    ogg_packet packet = {
        .packet = (unsigned char *)buf,
        .bytes = sizeof(buf),
    };
    int r = ogg_stream_packetin(os, &packet);
    if (r != 0)
        die(0, "could not write Opus comment");
}

static void write_opus_data(ogg_stream_state *os) {
    int pos = 0;
    for (size_t i = 0; i < gOrderSize; i++) {
        struct packet p = gPacketData[gOrderData[i]];
        pos += p.nsamples;
        ogg_packet packet = {
            .packet = (unsigned char *)gRawData + p.offset,
            .bytes = p.length,
            .e_o_s = i == gPacketSize - 1,
            .granulepos = pos,
        };
        int r = ogg_stream_packetin(os, &packet);
        if (r != 0)
            die(0, "could not write Opus packet");
    }
}

static void write_ogg_page(FILE *fp, ogg_stream_state *os) {
    while (true) {
        ogg_page og;
        int r = ogg_stream_pageout(os, &og);
        if (r == 0) {
            if (ogg_stream_check(os))
                die(0, "could not create Ogg page");
            return;
        }
        size_t amt = fwrite(og.header, 1, og.header_len, fp);
        if (amt != (size_t)og.header_len)
            die(errno, "could not write Ogg page");
        amt = fwrite(og.body, 1, og.body_len, fp);
        if (amt != (size_t)og.body_len)
            die(errno, "could not write Ogg page");
    }
}

static void write_opus(const char *fname) {
    gFile = fname;
    FILE *fp = fopen(fname, "wb");
    if (fp == NULL) {
        die(errno, "could not create file");
    }
    ogg_stream_state os;
    int r = ogg_stream_init(&os, 1);
    if (r != 0)
        die(0, "could not initialize Ogg stream");
    write_opus_head(&os);
    write_ogg_page(fp, &os);
    write_opus_tags(&os);
    write_ogg_page(fp, &os);
    write_opus_data(&os);
    write_ogg_page(fp, &os);
    if (fclose(fp) != 0) {
        die(errno, "could not create file");
    }
}

// =============================================================================

int main(int argc, char **argv) {
    if (argc != 4) {
        fputs(kUsage, stderr);
        return 2;
    }
    read_data(argv[1]);
    run_script(argv[2]);
    free(gAudioData);
    write_opus(argv[3]);
    free(gPacketData);
    free(gRawData);
    free(gOrderData);
    return 0;
}
