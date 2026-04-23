import { Select, Option } from "@material-tailwind/react";
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';

function valuetext(value) {
    return `${value}`;
}

export default function ScaleBlock({ question, scale: scaleProp, handleOptionSelect, audioIndex, questionIndex, selectedOptions }) {
    const scale = scaleProp || question.scale;

    if (scale.type === 'discrete') {
        return (
            <div className="flex flex-row flex-wrap justify-center gap-4">
                {scale.labels.map((option, optionIndex) => (
                    <label key={audioIndex + '_' + optionIndex} className="flex items-center cursor-pointer">
                        <input
                            className="mr-1"
                            type="radio"
                            name={`question-${audioIndex + '_' + questionIndex}`}
                            checked={selectedOptions[audioIndex] === option}
                            onChange={() => handleOptionSelect(option, audioIndex)}
                        />
                        {option}
                    </label>
                ))}
            </div>
        );
    }

    if (scale.type === 'dropdown') {
        return (
            <div className="w-[200px]">
                <Select
                    label="Select"
                    value={selectedOptions[audioIndex]}
                    onChange={(e) => handleOptionSelect(e, audioIndex)}
                    size="md"
                    className="text-left items-start content-start"
                >
                    {scale.labels.map((option, optionIndex) => (
                        <Option className="text-left" key={audioIndex + '_' + optionIndex} value={option}>
                            {option}
                        </Option>
                    ))}
                </Select>
            </div>
        );
    }

    if (scale.type === 'continuous') {
        const marks = scale.labels.map((label, index) => ({
            value: scale.values[index],
            label: label,
        }));

        return (
            <Box sx={{ width: '100%', maxWidth: 700, margin: '0 auto', px: 3, pb: 6 }}>
                <Slider
                    aria-label="Rating"
                    defaultValue={(scale.range[0] + scale.range[1]) / 2}
                    min={scale.range[0]}
                    max={scale.range[1]}
                    getAriaValueText={valuetext}
                    valueLabelDisplay="auto"
                    marks={marks}
                    onChange={(e, value) => handleOptionSelect(value, audioIndex)}
                    sx={{
                        '& .MuiSlider-markLabel': {
                            transform: 'translateX(-50%) !important',
                        },
                        '& .MuiSlider-markLabel[data-index="0"]': {
                            transform: 'translateX(-50%) !important',
                        },
                        [`& .MuiSlider-markLabel[data-index="${marks.length - 1}"]`]: {
                            transform: 'translateX(-50%) !important',
                        },
                    }}
                />
            </Box>
        );
    }

    return <p>Error! scale type not supported</p>;
}