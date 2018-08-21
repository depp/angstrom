from typing import Dict, List

class Phone:
    """A phone in the ARPABET.

    Attributes:
      name: ASCII name of the phone, for use in electronic dictionaries.
      kind: V1 (vowel, monopthong), V2 (vowel, dipthon),
            CU (consonant, unvoiced), CV (consonant, voiced).
      ipa: IPA notation.
      examples: List of example words containing the phone, with the letters
                pronounced as the phone surrounded by brackets.
    """
    def __init__(self, name: str, kind: str,
                 ipa: str, examples: List[str]) -> None:
        self.name = name
        self.kind = kin
        self.ipa = ipa
        self.examples = examples

PHONES: List[Phone] = [
    Phone("AA",  "V1", "ɑ", ["b[al]m", "b[o]t"]),
    Phone("AE",  "V1", "æ", ["b[a]t"]),
    Phone("AH",  "V1", "ʌ", ["b[u]tt"]),
    Phone("AO",  "V1", "ɔ", ["b[ough]t"]),
    Phone("AW",  "V2", "aʊ", ["b[ou]t"]),
    Phone("AX",  "V1", "ə", ["[a]bout"]),
    Phone("AXR", "V1", "ɚ", ["lett[er]"]),
    Phone("AY",  "V2", "aɪ", ["b[i]te"]),
    Phone("EH",  "V1", "ɛ", ["b[e]t"]),
    Phone("ER",  "V1", "ɝ", ["b[ir]d"]),
    Phone("EY",  "V2", "eɪ", ["b[ai]t"]),
    Phone("IH",  "V1", "ɪ", ["b[i]t"]),
    Phone("IX",  "V1", "ɨ", ["ros[e]s", "rabb[i]t"]),
    Phone("IY",  "V1", "i", ["b[ea]t"]),
    Phone("OW",  "V2", "oʊ", ["b[oa]t"]),
    Phone("OY",  "V2", "ɔɪ", ["b[oy]"]),
    Phone("UH",  "V1", "ʊ", ["b[oo]k"]),
    Phone("UW",  "V1", "u", ["b[oo]t"]),
    Phone("UX",  "V1", "ʉ", ["d[u]de"]),

    Phone("B",   "CV", "b", ["[b]uy"]),
    Phone("CH",  "CU", "tʃ", ["[Ch]ina"]),
    Phone("D",   "CV", "d", ["[d]ie"]),
    Phone("DH",  "CV", "ð", ["[th]y"]),
    Phone("DX",  "CU", "ɾ", ["bu[tt]er"]),
    Phone("EL",  "CV", "l̩", ["bott[le]"]),
    Phone("EM",  "CV", "m̩", ["rhyth[m]"]),
    Phone("EN",  "CV", "n̩", ["butto[n]"]),
    Phone("F",   "CU", "f", ["[f]ight"]),
    Phone("G",   "CV", "ɡ", ["[g]uy"]),
    Phone("HH",  "CU", "h", ["[h]igh"]),
    Phone("JH",  "CV", "dʒ", ["[j]ive"]),
    Phone("K",   "CU", "k", ["[k]ite"]),
    Phone("L",   "CV", "l", ["[l]ie"]),
    Phone("M",   "CV", "m", ["[m]y"]),
    Phone("N",   "CV", "n", ["[n]igh"]),
    Phone("NG",  "CV", "ŋ", ["si[ng]"]),
    Phone("NX",  "CV", "ɾ̃", ["wi[nn]er"]),
    Phone("P",   "CU", "p", ["[p]ie"]),
    Phone("Q",   "CU", "ʔ", ["uh[-]oh"]),
    Phone("R",   "CV", "ɹ", ["[r]ye"]),
    Phone("S",   "CU", "s", ["[s]igh"]),
    Phone("SH",  "CU", "ʃ", ["[sh]y"]),
    Phone("T",   "CU", "t", ["[t]ie"]),
    Phone("TH",  "CU", "θ", ["[th]igh"]),
    Phone("V",   "CV", "v", ["[v]ie"]),
    Phone("W",   "CV", "w", ["[w]ise"]),
    Phone("WH",  "CU", "ʍ", ["[wh]y"]),
    Phone("Y",   "CV", "j", ["[y]acht"]),
    Phone("Z",   "CV", "z", ["[z]oo"]),
    Phone("ZH",  "CV", "ʒ", ["plea[s]ure"]),
]

NAMES: Dict[str, Phone] = {p.name: p for p in PHONES}
