package fileset

import (
	"bytes"
	"testing"
	"time"
)

func TestSet(t *testing.T) {
	var (
		d1 = []byte{1}
		d2 = []byte{2}
		d3 = []byte{3}
		t1 = time.Date(2000, 1, 1, 12, 0, 0, 0, time.UTC)
		t2 = t1.Add(24 * time.Hour)
		t3 = t1.Add(48 * time.Hour)
	)
	s := NewSet()
	s.Set("a", t1, &Version{
		Data: d1,
	})
	s.Set("b", t1, &Version{
		Data: d2,
	})
	s.Set("a", t2, &Version{
		Data: d3,
	})
	s.Set("b", t2, nil)
	type qcase struct {
		n string
		t time.Time
		d []byte
	}
	qcases := []qcase{
		{"a", t1, d1},
		{"a", t2, d3},
		{"a", t3, nil},
		{"b", t1, d2},
		{"b", t2, nil},
	}
	for _, c := range qcases {
		vs := c.t.Format(timeFormat)
		v := s.GetVersion(c.n, vs)
		var got []byte
		if v != nil {
			got = v.Data
		}
		if !bytes.Equal(c.d, got) {
			t.Errorf("GetVersion(%q, %q): got %q, want %q", c.n, vs, got, c.d)
		}
	}
}
