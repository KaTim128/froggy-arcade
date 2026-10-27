# The police chase (PoliceEscape3D): fair chase and hiding rules

This file sets out the rules the officers follow in the 3D chase up the condo after the janitor room (log #79, "Define fair chase and hiding rules / Specify officer search state transitions"). Every number below comes from `src/scenes2d/PoliceEscape3D.ts`. `tools/policeai.mjs` and `tools/police.mjs` test the rules.

## Speeds

| | Speed | Note |
|---|---|---|
| You walking | 2.4 m/s | |
| You running | 4.0 m/s | |
| You sneaking (crouched) | 1.3 m/s | |
| Officer on the way to his floor | 8.0 m/s | 2× your run |
| Officer searching on his floor | 3.36 m/s | 1.4× your walk |
| Officer chasing you | 5.6 m/s | 1.4× your run |

Each officer is assigned a floor: officer 1 floor 6, officer 2 floor 3, officer 3 floor 1. He runs there first. Once he is there, or once he has seen you on the way, he is "arrived" and the speeds above apply. No floor is closed to you: levels 3–6 and 612 are always reachable, and the officers are simply fast enough to catch you if you dawdle.

## Being seen

- **Sight range:** 14 m standing, 8 m crouched. If his torch is on you, add 3 m.
- **Field of view:** about 109° (0.95 rad either side of where he faces).
- **Line of sight:** walls, shut doors and tall furniture block it. Low furniture blocks it only when you are crouched.
- **Height:** different floors never see each other. In the stairwell, the height difference must be under 1.7 m.
- **Suspicion builds before he spots you:** it builds faster when you are close (under 3 m), in his beam, standing, or moving. Crouching halves it. At 1 he has spotted you: he shouts, the others hear the radio, and a chase starts.
- **Right behind him:** within 2.0 m, with nothing in between, he knows you are there whichever way he faces (NEAR_SENSE).

## Being heard

- **Running is heard within 9 m on your floor.** In the stairwell it carries up to a floor and a half up or down. The officer who hears it knows it is you: he starts a chase toward the footsteps, and every footstep he hears updates where he thinks you are.
- **Walking and crouching make no noise.**
- **A door opened or shut:** an officer in earshot comes to look at where the sound came from, then searches the flat nearby.

## The chase

- He runs straight at you when you are on the same floor and in sight. Otherwise he follows the nav routes. In the stairwell he follows the flights and never cuts across the gap between them.
- **Out of sight is not gone.** For 2.5 s after losing sight of you (LKP_BUFFER), he keeps after where you actually are: round a corner, through a door you shut behind you, past him on a juke. A shut door does not lose him: he goes to it, opens it and comes in.
- **After those 2.5 s:** he goes to the last place he knew you were. If he gets there, or 6 s pass without sight, he is **lost**: he looks round, then searches that flat and one nearby.
- **Caught:** within 0.85 m of you, on the same level (height difference under 1 m), and you not in a hiding place.
- **Doors in a chase:** he goes through once a door is 56% open, the point where there is room for him. If he stands where the door has to swing, he steps out of its way.

## Hiding

There are four kinds of hiding place: under a bed, in a wardrobe, behind a shower curtain, and behind a bathroom door. Every open flat has at least one.

- **Not seen going in:** you are safe until an officer searches that very spot. When he searches a flat, he checks each of its hiding places with a chance:
  - the base chance is 0.28;
  - it goes up with the flat's "heat", which rises with noise and a recent sighting nearby;
  - it goes up the longer you stay in the same spot, by up to +0.4 after 90 s.
- **Seen going in:** if an officer could see you as you got in, he knows. He comes straight over, opens it, and you are caught. ("I SAW YOU GO IN THERE!")
- **Peeking:** while hidden and peeking, you can be seen only by an officer within 3.2 m who looks straight at your face with his torch on it. This builds suspicion and you are caught at 1.
- **No camping penalty:** you are never found without a search.

## Officer states

| State | Meaning |
|---|---|
| **task** | His list of jobs: go to a floor, along it, search flats, look round. When the list runs out he picks his next floor: his own floor twice as often as any other, rarely the one another officer is on, more often near you as the pressure rises, and seldom the one he has just left. |
| **alert** | Spotted: suspicion reached 1. For ALERT_S (0.6 s) he shouts, then chases. |
| **chase** | As described above. |
| **lost** | Look round, then search the flat where he lost you and one nearby. |
| **arrest** | He caught you: the jumpscare, then RESPAWN / LEAVE. |
| **scripted** | 612's cinematic. |

What moves an officer between states:
- **task → alert:** his suspicion reaches 1 (he saw you).
- **task / lost → chase:** he hears you running.
- **any → lost (searching one spot):** he sees you go into a hiding place. He goes straight to it and inspects it.
- **alert → chase:** 0.6 s after he spots you.
- **chase → lost:**
  - he reaches your last known position after the 2.5 s buffer;
  - or 6 s pass without sight.
- **lost → task:** his list of searches is done.
- **any → arrest:** he catches you.

### Coordination

- When one officer spots you, the radio sends the others:
  - one to the stair landing on your floor, to cut you off;
  - the rest to where you were.
- A flat on another officer's list is skipped, so two officers never search the same flat.
- A hiding place checked in the last 45 s is checked again at about a third of the usual chance, unless the flat is hot (heat over 0.5).
- Officers keep about a metre apart in corridors. The one behind waits up to 1.2 s.
- **Never stuck:**
  - an officer blocked for 0.6 s sidesteps;
  - after 1.5 s he skips that waypoint, and if that fails he re-plans the route;
  - in a chase, pressed against furniture for 0.45 s, he detours round it through the flat.
- `tools/policeai.mjs` checks that in nine awkward positions he never stands still for 2 s of game time.
