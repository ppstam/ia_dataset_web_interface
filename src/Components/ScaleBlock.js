import { Select, Option } from "@material-tailwind/react";
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';


function valuetext(value) {
    return `${value}`;
  }

export default function ScaleBlock({question, scale: scaleProp, handleOptionSelect, audioIndex, questionIndex, selectedOptions}) {
    // Use per-signal scale if provided, otherwise fall back to question.scale
    const scale = scaleProp || question.scale;

    if (scale.type === 'discrete') {
        return (
            <div className="flex flex-row flex-wrap justify-center gap-4">
                {scale.labels.map((option, optionIndex) => (
                    <label key={audioIndex + '_' + optionIndex} className="flex items-center cursor-pointer">
                        <input className='mr-1'
                            type="radio"
                            name={`question-${audioIndex + '_' + questionIndex}`}
                            checked={selectedOptions[audioIndex] === option}
                            onChange={() => handleOptionSelect(option, audioIndex)}
                        />
                        {option}
                    </label>
                ))}
            </div>
        )
    }
    if (scale.type === 'dropdown') {
        return (
            <div className="w-[200px]">
                <Select
                    label="Select"
                    value={selectedOptions[audioIndex]}
                    onChange={(e) => handleOptionSelect(e, audioIndex)}
                    size='md'
                    className="text-left items-start content-start"
                >
                    {scale.labels.map((option, optionIndex) => (
                        <Option className="text-left" key={audioIndex + '_' + optionIndex} value={option}>
                            {option}
                        </Option>
                    ))}
                </Select>
            </div>
        )
    }
    if (scale.type === 'continuous'){
        const marks = scale.labels.map((label, index) => {
            return {
                value: scale.values[index],
                label: label
            }
        })

        return (
        <Box className='flex flex-row' sx={{ width: 500, paddingX:5, wordWrap:"break-word" }}>

            <p className="mr-2 translate-y-8">{scale.borderLabels? scale.borderLabels[0]: null}</p>
            <Slider
    
              aria-label="Temperature"
              defaultValue={(scale.range[1]+scale.range[0])/2}
            //   value={selectedOptions[audioIndex]}
              getAriaValueText={valuetext}
              valueLabelDisplay="auto"
              marks={marks}
              onChange={(e) =>{console.log(e); handleOptionSelect(e.target.value, audioIndex)}}
              //color={selectedOptions[audioIndex] && selectedOptions[audioIndex] !== '' ? 'primary':'gray'}
              sx={{color: selectedOptions[audioIndex] && selectedOptions[audioIndex] !== '' ? 'primary':'gray'}}
              min={scale.range[0]}
              max={scale.range[1]}
            />
            <p className="mr-2 translate-y-8">{scale.borderLabels? scale.borderLabels[1]: null}</p>
          </Box>
          
        )
    }

    return <p>Error! scale type not supported</p>
}