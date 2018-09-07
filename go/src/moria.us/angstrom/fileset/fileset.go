// Package fileset stores a set of versioned files.
package fileset

import (
	"bytes"
	"time"
)

const (
	// fileRetention is the amount of time a file is kept after a newer version of
	// that file is created.
	fileRetention = 10 * time.Second
	timeFormat    = "2006-01-02T15:04:05.999"
)

func equalBytes(x, y []byte) bool {
	if x == nil {
		return y == nil
	}
	return y != nil && bytes.Equal(x, y)
}

// A Version is an individual verison of a file.
type Version struct {
	Data []byte
	Map  []byte

	sstamp string
	tstamp time.Time
	expiry time.Time
}

// A FileVersion is a paired filename and version.
type FileVersion struct {
	Name    string
	Version *Version
}

// VersionName returns the name of this version.
func (ver *Version) VersionName() string {
	return ver.sstamp
}

// Timestamp returns the timestamp of this version.
func (ver *Version) Timestamp() time.Time {
	return ver.tstamp
}

type file struct {
	exists   bool
	versions []*Version
}

// A Set is a set of versioned files.
type Set struct {
	expiring []*file
	files    map[string]*file
}

// New returns a new, empty set of files.
func New() *Set {
	return &Set{files: make(map[string]*file)}
}

// SetFile sets the latest version of a file. The verison can be nil, which
// marks the file as removed. Returns true if the set is modified.
func (s *Set) SetFile(name string, stamp time.Time, ver *Version) bool {
	f, ok := s.files[name]
	if !ok {
		if ver == nil {
			return false
		}
		f = new(file)
		s.files[name] = f
	}
	var prev *Version
	if len(f.versions) != 0 {
		prev = f.versions[0]
	}
	if ver == nil {
		if !f.exists {
			return false
		}
		f.exists = false
	} else {
		ver.tstamp = stamp
		ver.sstamp = stamp.Format(timeFormat)
		if f.exists && bytes.Equal(ver.Data, prev.Data) && bytes.Equal(ver.Map, prev.Map) {
			return false
		}
		f.versions = append(f.versions, nil)
		copy(f.versions[1:], f.versions)
		f.versions[0] = ver
		f.exists = true
	}
	if prev != nil && !prev.expiry.IsZero() {
		prev.expiry = stamp.Add(fileRetention)
		s.expiring = append(s.expiring, f)
	}
	return true
}

// SetFiles sets the latest version of many files. Returns true if the set is
// modified.
func (s *Set) SetFiles(stamp time.Time, files []FileVersion) bool {
	var changed bool
	for _, f := range files {
		if s.SetFile(f.Name, stamp, f.Version) {
			changed = true
		}
	}
	return changed
}

// Expire purges all file versions with an expiry before the given time.
func (s *Set) Expire(stamp time.Time) {
	var n int
	for i, f := range s.expiring {
		ver := f.versions[len(f.versions)-1]
		if !stamp.After(ver.expiry) {
			break
		}
		f.versions[len(f.versions)-1] = nil
		f.versions = f.versions[:len(f.versions)-1]
		n = i + 1
	}
	if n == 0 {
		return
	}
	copy(s.expiring, s.expiring[n:])
	j := len(s.expiring) - n
	for i := range s.expiring[j:] {
		s.expiring[j+i] = nil
	}
	s.expiring = s.expiring[:j]
}

// GetVersion returns a specific version of a file.
func (s *Set) GetVersion(name, stamp string) *Version {
	f, ok := s.files[name]
	if !ok {
		return nil
	}
	for _, v := range f.versions {
		if v.sstamp == stamp {
			return v
		}
	}
	return nil
}

// GetLatest returns the latest version for a file.
func (s *Set) GetLatest(name string) *Version {
	f, ok := s.files[name]
	if !ok || !f.exists {
		return nil
	}
	return f.versions[0]
}

// A Manifest contains the current version stamp for each file.
type Manifest map[string]string

// GetDelta updates a manifest, and returns the changes applied to the manifest.
func (s *Set) GetDelta(m Manifest) map[string]*string {
	var delta map[string]*string
	for k, f := range s.files {
		if !f.exists {
			if _, ok := m[k]; ok {
				if delta == nil {
					delta = make(map[string]*string)
				}
				delta[k] = nil
				delete(m, k)
			}
		} else if sv := f.versions[0].sstamp; m[k] != sv {
			if delta == nil {
				delta = make(map[string]*string)
			}
			vp := new(string)
			*vp = sv
			delta[k] = vp
			m[k] = sv
		}
	}
	return delta
}
