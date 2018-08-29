package project

import (
	"errors"
	"fmt"
	"log"
	"path"
	"regexp"
	"sort"
	"strings"

	"moria.us/angstrom/encoder"
)

// ErrNotFound indicates that the named resource does not exist in the project.
var ErrNotFound = errors.New("object not found")

var nonAlpha = regexp.MustCompile("[^a-zA-Z0-9]+")

// A Configuration configures the encoder settings. This is the same as
// encoder.Configuration, except the fields are optional.
type Configuration struct {
	Bandwidth   *encoder.Bandwidth `json:"bandwidth,omitempty"`
	Bitrate     *int               `json:"bitrate,omitempty"`
	Independent *bool              `json:"independent,omitempty"`
}

// Merge combines several configuration settings into one.
func Merge(base encoder.Configuration, delta ...Configuration) encoder.Configuration {
	for _, d := range delta {
		if v := d.Bandwidth; v != nil {
			base.Bandwidth = *v
		}
		if v := d.Bitrate; v != nil {
			base.Bitrate = *v
		}
		if v := d.Independent; v != nil {
			base.Independent = *v
		}
	}
	return base
}

// A Packet is the configuration for a single packet in an audio slice.
type Packet struct {
	Length int `json:"length"`
	Configuration
}

// A SliceData is the part of a Slice which is persisted.
type SliceData struct {
	Class    string   `json:"class,omitempty"`
	Selected bool     `json:"selected,omitempty"`
	Pos      int      `json:"pos"`
	Packets  []Packet `json:"packets"`
	Comment  string   `json:"comment,omitempty"`
}

// A Slice is a piece of an input audio clip which will be encoded as Opus
// packets.
type Slice struct {
	Clip  string `json:"clip"`
	Index int    `json:"index"`
	SliceData
}

// A SegmentData is the part of a Segment which is persisted.
type SegmentData struct {
	Source string `json:"source"`
	Pos    int    `json:"pos"`
	Length int    `json:"length,omitempty"`
}

// A Segment is a piece of an autoput audio clip that will be emitted as Opus
// packets from a specific slice.
type Segment struct {
	Clip  string `json:"clip"`
	Index int    `json:"index"`
	SegmentData
}

// A ClipInfo contains the metadata for a clip.
type ClipInfo struct {
	Name   string `json:"name"`
	Title  string `json:"title"`
	Length int    `json:"length"`
	File   string `json:"file"`
}

func (c *ClipInfo) defaultTitle() string {
	title := path.Base(c.File)
	i := strings.LastIndexByte(title, '.')
	if i != -1 {
		title = title[:i]
	}
	if title == "" {
		title = "Untitled"
	}
	return title
}

func (c *ClipInfo) defaultName() string {
	name := nonAlpha.ReplaceAllString(c.Title, "-")
	name = strings.TrimPrefix(name, "-")
	name = strings.TrimSuffix(name, "-")
	if name == "" {
		name = "clip"
	}
	return name
}

// A Clip is an audio clip being analyzed, sliced into slices, and recombined
// into a sequence of output segments.
type Clip struct {
	ClipInfo
	Slices   []*Slice   `json:"slices"`
	Segments []*Segment `json:"segments"`
}

func (c *Clip) isDefault() bool {
	return c.Title == c.defaultTitle() &&
		len(c.Slices) == 0 &&
		len(c.Segments) == 0
}

// A Class is a class of audio slices which can be substituted for each other
// because they contain a similar sound. One clip in the class may be selected.
type Class struct {
	Name   string
	Slices []*Slice
}

// A Project contains audio clips and all the settings for encoding them as Opus.
type Project struct {
	root     string // Root directory.
	inputDir string // Audio input directory.
	clips    map[string]*Clip
	files    map[string]*Clip
	classes  map[string]*Class
}

// =============================================================================

type clipInfoSlice []*ClipInfo

func (s clipInfoSlice) Len() int           { return len(s) }
func (s clipInfoSlice) Less(i, j int) bool { return s[i].Name < s[j].Name }
func (s clipInfoSlice) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }

// GetClips returns a list of all clips.
func (p *Project) GetClips() ([]*ClipInfo, error) {
	clips := make([]*ClipInfo, 0, len(p.clips))
	for _, c := range p.clips {
		clips = append(clips, &c.ClipInfo)
	}
	sort.Sort(clipInfoSlice(clips))
	return clips, nil
}

// GetClip returns the named clip.
func (p *Project) GetClip(clip string) (*Clip, error) {
	c, ok := p.clips[clip]
	if !ok {
		return nil, ErrNotFound
	}
	return c, nil
}

// UpdateClip replaces the metadata in the named clip.
func (p *Project) UpdateClip(clip string, data *ClipInfo) error {
	c, ok := p.clips[clip]
	if !ok {
		return ErrNotFound
	}
	if data.Name != "" {
		c.Name = data.Name
	}
	if data.Title != "" {
		c.Title = data.Title
	}
	return nil
}

func (p *Project) addClip(clip *Clip) {
	if clip.Title == "" {
		clip.Title = clip.defaultTitle()
	}
	if clip.Name == "" {
		clip.Name = clip.defaultName()
	}
	name := clip.Name
	for n := 2; ; n++ {
		if _, ok := p.clips[name]; !ok {
			break
		}
		name = fmt.Sprintf("%s-%d", name, n)
	}
	clip.Name = name
	for i, s := range clip.Slices {
		s.Clip = name
		s.Index = i
	}
	for i, s := range clip.Segments {
		s.Clip = name
		s.Index = i
	}
	p.clips[name] = clip
	if _, ok := p.files[clip.File]; ok {
		log.Printf("Warning: multiple entries for audio file %q", clip.File)
	} else {
		p.files[clip.File] = clip
	}
}

// =============================================================================

func (p *Project) insertSlice(c *Clip, data *Slice) {
	// Insert into clip.
	pos := len(c.Slices)
	for i, s := range c.Slices {
		if s.Pos > data.Pos {
			pos = i
			break
		}
	}
	c.Slices = append(c.Slices, nil)
	copy(c.Slices[pos+1:], c.Slices[pos:])
	c.Slices[pos] = data
	data.Clip = c.Name
	for i, s := range c.Slices[pos:] {
		s.Index = pos + i
	}

	// Insert into class.
	if name := data.Class; name != "" {
		k, ok := p.classes[name]
		if !ok {
			k = &Class{Name: name}
			p.classes[name] = k
		}
		if data.Selected {
			for _, s := range k.Slices {
				s.Selected = false
			}
		}
		k.Slices = append(k.Slices, data)
	}
}

func (p *Project) deleteSlice(c *Clip, slice int) {
	// Remove from class.
	data := c.Slices[slice]
	if name := data.Class; name != "" {
		c := p.classes[name]
		for i, s := range c.Slices {
			if s == data {
				copy(c.Slices[i:], c.Slices[i+1:])
				c.Slices[len(c.Slices)-1] = nil
				c.Slices = c.Slices[:len(c.Slices)-1]
				if len(c.Slices) == 0 {
					delete(p.classes, name)
				}
				break
			}
		}
	}

	// Remove from clip.
	copy(c.Slices[slice:], c.Slices[slice+1:])
	c.Slices[len(c.Slices)-1] = nil
	c.Slices = c.Slices[:len(c.Slices)-1]
	for i, s := range c.Slices[slice:] {
		s.Index = slice + i
	}
}

// InsertSlice adds a new audio slice to the clip. The project takes ownership
// of the slice, and updates its Clip and Index fields to indicate its new
// location.
func (p *Project) InsertSlice(clip string, data *Slice) error {
	c, ok := p.clips[clip]
	if !ok {
		return ErrNotFound
	}
	p.insertSlice(c, data)
	return nil
}

// GetSlice returns the named slice.
func (p *Project) GetSlice(clip string, slice int) (*Slice, error) {
	c, ok := p.clips[clip]
	if !ok {
		return nil, ErrNotFound
	}
	if slice < 0 || len(c.Slices) <= slice {
		return nil, ErrNotFound
	}
	return c.Slices[slice], nil
}

// DeleteSlice removes the named slice.
func (p *Project) DeleteSlice(clip string, slice int, data *Slice) error {
	c, ok := p.clips[clip]
	if !ok {
		return ErrNotFound
	}
	if slice < 0 || len(c.Slices) <= slice {
		return ErrNotFound
	}
	p.deleteSlice(c, slice)
	return nil
}

// UpdateSlice replaces the named slice with a new one. The project takes
// ownership of the slice, and updates its Clip and Index fields to indicate its
// new location.
func (p *Project) UpdateSlice(clip string, slice int, data *Slice) error {
	c, ok := p.clips[clip]
	if !ok {
		return ErrNotFound
	}
	if slice < 0 || len(c.Slices) <= slice {
		return ErrNotFound
	}
	p.deleteSlice(c, slice)
	p.insertSlice(c, data)
	return nil
}

// =============================================================================

func (*Project) insertSegment(c *Clip, data *Segment) {
	pos := len(c.Segments)
	for i, s := range c.Segments {
		if s.Pos > data.Pos {
			pos = i
			break
		}
	}
	c.Segments = append(c.Segments, nil)
	copy(c.Segments[pos+1:], c.Segments[pos:])
	c.Segments[pos] = data
	data.Clip = c.Name
	for i, s := range c.Segments[pos:] {
		s.Index = pos + i
	}
}

func (*Project) deleteSegment(c *Clip, segment int) {
	copy(c.Segments[segment:], c.Segments[segment+1:])
	c.Segments[len(c.Segments)-1] = nil
	c.Segments = c.Segments[:len(c.Segments)-1]
	for i, s := range c.Segments[segment:] {
		s.Index = segment + i
	}
}

// InsertSegment adds a new audio segment to the clip. The project takes
// ownership of the segment, and updates its Clip and Index fields to indicate
// ins new location.
func (p *Project) InsertSegment(clip string, data *Segment) error {
	c, ok := p.clips[clip]
	if !ok {
		return ErrNotFound
	}
	p.insertSegment(c, data)
	return nil
}

// GetSegment returns the named segment.
func (p *Project) GetSegment(clip string, segment int) (*Segment, error) {
	c, ok := p.clips[clip]
	if !ok {
		return nil, ErrNotFound
	}
	if segment < 0 || len(c.Segments) <= segment {
		return nil, ErrNotFound
	}
	return c.Segments[segment], nil
}

// DeleteSegment removes the named segment.
func (p *Project) DeleteSegment(clip string, segment int, data *Segment) error {
	c, ok := p.clips[clip]
	if !ok {
		return ErrNotFound
	}
	if segment < 0 || len(c.Segments) <= segment {
		return ErrNotFound
	}
	p.deleteSegment(c, segment)
	return nil
}

// UpdateSegment replaces the named segment with a new one. The project takes
// ownership of the segment, and updates its Clip and Index fields to indicate
// its new position.
func (p *Project) UpdateSegment(clip string, segment int, data *Segment) error {
	c, ok := p.clips[clip]
	if !ok {
		return ErrNotFound
	}
	if segment < 0 || len(c.Segments) <= segment {
		return ErrNotFound
	}
	p.deleteSegment(c, segment)
	p.insertSegment(c, data)
	return nil
}
