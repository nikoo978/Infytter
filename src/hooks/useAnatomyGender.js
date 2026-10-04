import { useSyncExternalStore } from "react";
import { readAnatomyGender, setAnatomyGender, subscribeAnatomyGender } from "../services/anatomyPreference";
const serverSnapshot = () => "male";
export default function useAnatomyGender() {
  return [useSyncExternalStore(subscribeAnatomyGender, readAnatomyGender, serverSnapshot), setAnatomyGender];
}
