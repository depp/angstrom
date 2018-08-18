opustool:

opus_cflags := $(shell pkg-config --cflags ogg opus)
opus_libs := $(shell pkg-config --libs ogg opus)

CFLAGS = -std=gnu11 -O2 -g
-include config.mak
override CFLAGS += $(opus_cflags)

main.o: main.c

opustool: main.o
	$(CC) -o $@ $(LDFLAGS) $^ $(LIBS) $(opus_libs)

clean:
	rm -f *.o
.PHONY: clean
