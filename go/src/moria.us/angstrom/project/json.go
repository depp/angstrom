package project

import (
	"bytes"
	"encoding/json"
	"sort"
)

type clip struct {
	Title    string         `json:"title"`
	File     string         `json:"file"`
	Slices   []*SliceData   `json:"slices,omitempty"`
	Segments []*SegmentData `json:"segments,omitempty"`
}

type project struct {
	Clips []*clip `json:"clips"`
}

// loadJSON loads the serialized project from JSON data. Each clip in the JSON
// will appear as a new clip in the project.
func (p *Project) loadJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	pr := new(project)
	if err := dec.Decode(pr); err != nil {
		return err
	}
	for _, cl := range pr.Clips {
		slices := make([]*Slice, 0, len(cl.Slices))
		for _, s := range cl.Slices {
			slices = append(slices, &Slice{SliceData: *s})
		}
		segments := make([]*Segment, 0, len(cl.Segments))
		for _, s := range cl.Segments {
			segments = append(segments, &Segment{SegmentData: *s})
		}
		p.addClip(&Clip{
			ClipInfo: ClipInfo{
				Title: cl.Title,
				File:  cl.File,
			},
			Slices:   slices,
			Segments: segments,
		})
	}
	return nil
}

type clipJSONSlice []*clip

func (s clipJSONSlice) Len() int           { return len(s) }
func (s clipJSONSlice) Less(i, j int) bool { return s[i].File < s[j].File }
func (s clipJSONSlice) Swap(i, j int)      { s[i], s[j] = s[j], s[i] }

// toJSON returns the serialized project as JSON data.
func (p *Project) toJSON() ([]byte, error) {
	clips := make([]*clip, 0, len(p.clips))
	for _, c := range p.clips {
		if c.isDefault() {
			continue
		}
		slices := make([]*SliceData, 0, len(c.Slices))
		for _, s := range c.Slices {
			slices = append(slices, &s.SliceData)
		}
		segments := make([]*SegmentData, 0, len(c.Segments))
		for _, s := range c.Segments {
			segments = append(segments, &s.SegmentData)
		}
		clips = append(clips, &clip{
			Title:    c.Title,
			File:     c.File,
			Slices:   slices,
			Segments: segments,
		})
	}
	sort.Sort(clipJSONSlice(clips))
	pr := &project{Clips: clips}

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	if err := enc.Encode(pr); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
