"""The narration script for the demo video: (id, text spoken, text shown as caption; None = same as spoken)."""
VOICE = "en-US-AndrewNeural"

LINES = [
    ("A", "Every evening, Taiwan's grid planners decide how much backup power to keep ready for tomorrow's peak. "
          "Too little, and spare power drops under ten percent, Taipower's yellow light, with a risk of blackouts. "
          "Too much, and fossil-fuel plants sit idle. It all comes down to one number: tomorrow's peak demand.",
          "Every evening, Taiwan's grid planners decide how much backup power to keep ready for tomorrow's peak. "
          "Too little, and spare power drops under 10%, Taipower's yellow light, with a risk of blackouts. "
          "Too much, and fossil-fuel plants sit idle. It all comes down to one number: tomorrow's peak demand."),
    ("B1", "This is Power Weather Taiwan. Each forecast was made the evening before, from the weather forecast, "
           "the holiday calendar and recent demand. For Monday, August third: forty point five gigawatts. "
           "The real peak: forty point seven. 'Same as today' was fourteen percent too low, because today was a Sunday.",
           "This is Power Weather Taiwan. Each forecast was made the evening before, from the weather forecast, "
           "the holiday calendar and recent demand. For Monday 3 August: 40.5 GW. The real peak: 40.7 GW. "
           "\"Same as today\" was 14% too low, because today was a Sunday."),
    ("B2", "Across 2026, a year the model never saw, it misses by one point seven five percent on average. "
           "'Same as today' misses by five.",
           "Across 2026, a year the model never saw, it misses by 1.75% on average. \"Same as today\" misses by 5%."),
    ("B3", "It fails on typhoon days. Cities call off work the evening before, and that isn't in the calendar, "
           "so for Typhoon Champi it was sixteen percent too high.",
           "It fails on typhoon days. Cities call off work the evening before, and that isn't in the calendar, "
           "so for Typhoon Champi it was 16% too high."),
    ("B4", "You can also ask: what if tomorrow is a thirty-five degree workday? "
           "Above twenty-nine degrees, every extra degree adds about seven hundred megawatts.",
           "You can also ask: what if tomorrow is a 35 °C workday? Above 29 °C, every extra degree adds about 700 MW."),
    ("C1", "We used almost four years of Taipower's open data, the holiday calendar and weather for seven cities, "
           "and we found sixteen typos in Taipower's own table.",
           "We used almost four years of Taipower's open data, the holiday calendar and weather for seven cities, "
           "and we found 16 typos in Taipower's own table."),
    ("C2", "The model is a ridge regression with seventeen inputs. A tree model did worse, two point six percent, "
           "because trees can't forecast above the records they've already seen.",
           "The model is a ridge regression with 17 inputs. A tree model did worse, 2.6%, "
           "because trees can't forecast above the records they've already seen."),
    ("D1", "Our own question: can public data warn about yellow-light days? No. On those days demand was a bit below normal, "
           "but supply was nine percent low, because power plants were down. A weather forecast can't see that.",
           "Our own question: can public data warn about yellow-light days? No. On those days demand was a bit below normal, "
           "but supply was 9% low, because power plants were down. A weather forecast can't see that."),
    ("D2", "Next, we'll add typhoon days off and Taipower's maintenance plans. The model runs in your browser, "
           "and the code is on GitHub.", None),
]
