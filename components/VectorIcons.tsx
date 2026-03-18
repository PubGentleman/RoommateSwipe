import React from 'react';
import Svg, { Path, Circle, Line, Polyline, Rect, Polygon } from 'react-native-svg';
import { featherSvgData } from '../constants/featherPaths';

interface FeatherProps {
  name: string;
  size?: number;
  color?: string;
}

function parseSvgContent(svgString: string, color: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let idx = 0;

  const tagRegex = /<(\w+)\s([^>]*)(?:\/>|>[^<]*<\/\w+>)/g;
  let match;

  while ((match = tagRegex.exec(svgString)) !== null) {
    const tag = match[1];
    const attrsStr = match[2];
    const attrs: Record<string, string> = {};

    const attrRegex = /(\w[\w-]*)="([^"]*)"/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }

    const key = `el-${idx++}`;
    const commonProps = {
      stroke: color,
      strokeWidth: '2',
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      fill: 'none',
    };

    switch (tag) {
      case 'path':
        elements.push(<Path key={key} d={attrs.d} {...commonProps} />);
        break;
      case 'circle':
        elements.push(
          <Circle
            key={key}
            cx={attrs.cx}
            cy={attrs.cy}
            r={attrs.r}
            {...commonProps}
          />
        );
        break;
      case 'line':
        elements.push(
          <Line
            key={key}
            x1={attrs.x1}
            y1={attrs.y1}
            x2={attrs.x2}
            y2={attrs.y2}
            {...commonProps}
          />
        );
        break;
      case 'polyline':
        elements.push(
          <Polyline key={key} points={attrs.points} {...commonProps} />
        );
        break;
      case 'rect':
        elements.push(
          <Rect
            key={key}
            x={attrs.x}
            y={attrs.y}
            width={attrs.width}
            height={attrs.height}
            rx={attrs.rx}
            ry={attrs.ry}
            {...commonProps}
          />
        );
        break;
      case 'polygon':
        elements.push(
          <Polygon key={key} points={attrs.points} {...commonProps} />
        );
        break;
    }
  }

  return elements;
}

export function Feather({ name, size = 24, color = '#FFFFFF' }: FeatherProps) {
  const svgData = featherSvgData[name];

  if (!svgData) {
    return null;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {parseSvgContent(svgData, color)}
    </Svg>
  );
}
