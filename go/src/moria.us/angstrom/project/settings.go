package project

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/BurntSushi/toml"

	"moria.us/angstrom/audio"
)

const (
	settingsFile = "angstrom_settings.toml"
	dataFile     = "angstrom_data.json"
)

type editSettings struct {
	InputDir string `toml:"inputdir"`
}

type settings struct {
	Edit editSettings `toml:"edit"`
}

// Open opens a project, reading the settings from disk.
func Open(dir string) (*Project, error) {
	fpath := filepath.Join(dir, settingsFile)
	set := new(settings)
	md, err := toml.DecodeFile(fpath, set)
	if err != nil {
		return nil, err
	}
	if undec := md.Undecoded(); len(undec) != 0 {
		keys := make([]string, 0, len(undec))
		for _, key := range undec {
			keys = append(keys, key.String())
		}
		return nil, fmt.Errorf("%q contains unknown keys: %s", fpath, strings.Join(keys, ", "))
	}

	p := &Project{
		root:     dir,
		inputDir: path.Clean(set.Edit.InputDir),
		clips:    make(map[string]*Clip),
		files:    make(map[string]*Clip),
		classes:  make(map[string]*Class),
	}

	fpath = filepath.Join(dir, dataFile)
	data, err := ioutil.ReadFile(fpath)
	if err != nil {
		if !os.IsNotExist(err) {
			return nil, err
		}
	} else {
		if err := p.loadJSON(data); err != nil {
			return nil, fmt.Errorf("%q: %v", fpath, err)
		}
	}

	return p, nil
}

// Save writes the project data to disk.
func (p *Project) Save() error {
	data, err := p.toJSON()
	if err != nil {
		return err
	}
	return ioutil.WriteFile(filepath.Join(p.root, dataFile), data, 0666)
}

// ScanAudio scans the input directory for WAVE files and adds them to the
// project. Errors encountered when scanning an individual WAVE file are logged
// and ignored.
func (p *Project) ScanAudio() error {
	sts, err := ioutil.ReadDir(filepath.Join(p.root, p.inputDir))
	if err != nil {
		return err
	}
	for _, st := range sts {
		if st.Mode()&os.ModeType != 0 {
			continue
		}
		name := st.Name()
		if !strings.HasSuffix(name, ".wav") || strings.HasPrefix(name, ".") {
			continue
		}
		file := path.Join(p.inputDir, name)
		data, err := audio.ReadFile(filepath.Join(p.root, p.inputDir, name))
		if err != nil {
			log.Printf("Error: could not add WAVE file %q: %v", file, err)
			continue
		}
		if c, ok := p.files[file]; ok {
			c.Length = len(data)
		} else {
			p.addClip(&Clip{ClipInfo: ClipInfo{File: file, Length: len(data)}})
		}
	}
	return nil
}
